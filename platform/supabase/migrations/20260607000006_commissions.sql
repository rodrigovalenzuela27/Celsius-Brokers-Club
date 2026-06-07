-- ============================================================
-- Celsius Platform · Fase 4 · Motor de comisiones + payment runs
--
-- Ciclo de vida (consola admin §13 del prototipo):
--   accruing  → la cotización avanza, aún no se devenga
--   earned    → se cumplió el hito de devengo del proyecto
--   scheduled → incluida en un payment run aprobado
--   paid      → dispersada (SPEI real llega con credenciales)
--   reversed  → cliente canceló dentro de la ventana de retención
--   cancelled → la cotización murió antes de devengar
--
-- El hito de devengo es política POR PROYECTO
-- (policy_overrides.commission_milestone: reserved | promised | won).
-- ============================================================

create type public.commission_status as enum
  ('accruing', 'earned', 'scheduled', 'paid', 'reversed', 'cancelled');

create type public.payment_run_status as enum ('draft', 'approved', 'processed');

-- ---------- PAYMENT_RUN ----------
create table public.payment_run (
  id            uuid primary key default gen_random_uuid(),
  developer_id  uuid not null references public.developer (id),
  run_date      date not null,
  status        public.payment_run_status not null default 'draft',
  gross_mxn     numeric(14,2) not null default 0,
  isr_pct       numeric(5,2) not null default 10,   -- retención ISR persona física
  isr_mxn       numeric(14,2) not null default 0,
  net_mxn       numeric(14,2) not null default 0,
  created_by    uuid references public.profile (id),
  approved_at   timestamptz,
  processed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_payment_run_updated_at before update on public.payment_run
  for each row execute function public.set_updated_at();

-- ---------- COMMISSION ----------
create sequence public.commission_folio_seq start 100;

create table public.commission (
  id               uuid primary key default gen_random_uuid(),
  folio            text not null unique
                   default ('COM-2026-' || lpad(nextval('public.commission_folio_seq')::text, 4, '0')),
  developer_id     uuid not null references public.developer (id),
  quote_id         uuid not null unique references public.quote (id),
  broker_id        uuid not null references public.profile (id),
  project_id       uuid not null references public.project (id),
  base_pct         numeric(5,2) not null,
  amount_mxn       numeric(14,2) not null,
  milestone        text not null,                   -- reserved | promised | won
  status           public.commission_status not null default 'accruing',
  earned_at        timestamptz,
  target_pay_date  date,
  retention_days   int not null default 90,
  payment_run_id   uuid references public.payment_run (id),
  paid_at          timestamptz,
  reversed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_commission_broker on public.commission (broker_id);
create index idx_commission_status on public.commission (status);
create trigger trg_commission_updated_at before update on public.commission
  for each row execute function public.set_updated_at();
create trigger trg_audit_commission after insert or update on public.commission
  for each row execute function public.write_audit_event();
create trigger trg_audit_payment_run after insert or update on public.payment_run
  for each row execute function public.write_audit_event();

-- ---------- RLS ----------
alter table public.commission enable row level security;
alter table public.payment_run enable row level security;

create policy commission_select on public.commission
  for select to authenticated
  using (
    developer_id = public.current_developer_id()
    and (broker_id = auth.uid() or public.is_admin())
  );

create policy payment_run_admin_select on public.payment_run
  for select to authenticated
  using (developer_id = public.current_developer_id() and public.is_admin());

-- Las mutaciones SOLO ocurren vía funciones definer / triggers.

-- ---------- % base de comisión ----------
-- Interno 3% · externo: % del convenio (brokerage_project_access) o 2.5%.
create or replace function public.commission_base_pct(p_broker_id uuid, p_project_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when pr.role = 'broker_internal' then 3.0
    else coalesce(
      (select bpa.commission_pct from public.brokerage_project_access bpa
       where bpa.brokerage_id = pr.brokerage_id and bpa.project_id = p_project_id),
      2.5)
  end
  from public.profile pr
  where pr.id = p_broker_id;
$$;

-- ---------- Ciclo de vida: triggers sobre QUOTE ----------
-- Alta: toda cotización de canal broker abre una comisión "accruing".
create or replace function public.commission_on_quote_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_pct numeric;
  v_milestone text;
begin
  if new.channel <> 'broker' or new.broker_id is null then
    return new; -- compra directa: sin comisión
  end if;

  select u.project_id into v_project_id from public.unit u where u.id = new.unit_id;
  v_pct := public.commission_base_pct(new.broker_id, v_project_id);
  select coalesce(p.policy_overrides ->> 'commission_milestone', 'reserved')
    into v_milestone from public.project p where p.id = v_project_id;

  insert into public.commission (developer_id, quote_id, broker_id, project_id, base_pct, amount_mxn, milestone)
  values (new.developer_id, new.id, new.broker_id, v_project_id,
          v_pct, round(new.net_price_mxn * v_pct / 100, 2), v_milestone);
  return new;
end;
$$;
create trigger trg_commission_on_quote_insert after insert on public.quote
  for each row execute function public.commission_on_quote_insert();

-- Transiciones: devengo al cumplir el hito; reverso/cancelación si muere.
create or replace function public.commission_on_quote_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_com public.commission%rowtype;
  v_pay_days int;
  v_milestone_reached boolean;
begin
  if new.status = old.status then return new; end if;

  select * into v_com from public.commission where quote_id = new.id;
  if not found then return new; end if;

  -- ¿El nuevo estado alcanza (o supera) el hito de devengo?
  v_milestone_reached := case v_com.milestone
    when 'reserved' then new.status in ('reserved', 'promised', 'won')
    when 'promised' then new.status in ('promised', 'won')
    when 'won' then new.status = 'won'
    else false
  end;

  if v_com.status = 'accruing' and v_milestone_reached then
    select coalesce((p.policy_overrides ->> 'commission_pay_days')::int, 30)
      into v_pay_days from public.project p where p.id = v_com.project_id;
    update public.commission
      set status = 'earned',
          earned_at = now(),
          target_pay_date = (now() + make_interval(days => v_pay_days))::date
      where id = v_com.id;

  elsif new.status in ('expired', 'cancelled') then
    if v_com.status = 'accruing' then
      update public.commission set status = 'cancelled' where id = v_com.id;
    elsif v_com.status in ('earned', 'scheduled')
      and v_com.earned_at > now() - make_interval(days => v_com.retention_days) then
      -- cliente canceló dentro de la ventana de retención: reverso
      update public.commission
        set status = 'reversed', reversed_at = now(), payment_run_id = null
        where id = v_com.id;
    end if;
  end if;

  return new;
end;
$$;
create trigger trg_commission_on_quote_status after update on public.quote
  for each row execute function public.commission_on_quote_status();

-- ---------- Payment runs (admin) ----------
-- Crea un run en borrador con las comisiones devengadas cuyo pago
-- objetivo cae dentro del run.
create or replace function public.create_payment_run(p_run_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.payment_run%rowtype;
  v_gross numeric;
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede crear payment runs';
  end if;

  insert into public.payment_run (developer_id, run_date, created_by)
  values (public.current_developer_id(), p_run_date, auth.uid())
  returning * into v_run;

  update public.commission
    set status = 'scheduled', payment_run_id = v_run.id
    where status = 'earned'
      and developer_id = v_run.developer_id
      and target_pay_date <= p_run_date;

  select coalesce(sum(amount_mxn), 0), count(*) into v_gross, v_count
    from public.commission where payment_run_id = v_run.id;

  if v_count = 0 then
    delete from public.payment_run where id = v_run.id;
    raise exception 'No hay comisiones devengadas con pago objetivo al %', p_run_date;
  end if;

  update public.payment_run
    set gross_mxn = v_gross,
        isr_mxn = round(v_gross * isr_pct / 100, 2),
        net_mxn = v_gross - round(v_gross * isr_pct / 100, 2)
    where id = v_run.id;

  return jsonb_build_object('run_id', v_run.id, 'commissions', v_count, 'gross_mxn', v_gross);
end;
$$;

create or replace function public.approve_payment_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede aprobar payment runs';
  end if;
  update public.payment_run
    set status = 'approved', approved_at = now()
    where id = p_run_id and status = 'draft'
      and developer_id = public.current_developer_id();
  if not found then
    raise exception 'El run no existe o no está en borrador';
  end if;
end;
$$;

-- Marca el run como procesado y las comisiones como pagadas.
-- (La dispersión SPEI real se integra aquí cuando haya proveedor.)
create or replace function public.process_payment_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.payment_run%rowtype;
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede procesar payment runs';
  end if;

  select * into v_run from public.payment_run
    where id = p_run_id and developer_id = public.current_developer_id()
    for update;
  if not found or v_run.status <> 'approved' then
    raise exception 'El run debe estar aprobado antes de procesarse';
  end if;

  update public.commission
    set status = 'paid', paid_at = now()
    where payment_run_id = p_run_id and status = 'scheduled';
  get diagnostics v_count = row_count;

  update public.payment_run
    set status = 'processed', processed_at = now()
    where id = p_run_id;

  return jsonb_build_object('paid_commissions', v_count, 'net_mxn', v_run.net_mxn);
end;
$$;

grant execute on function public.create_payment_run to authenticated;
grant execute on function public.approve_payment_run to authenticated;
grant execute on function public.process_payment_run to authenticated;

-- ============================================================
-- HUBSPOT · encolado de eventos outbound (el worker que los
-- consume llega cuando existan credenciales; mientras, la
-- bitácora registra todo lo que habría que sincronizar).
-- ============================================================
create or replace function public.enqueue_hubspot_event()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_object text;
begin
  v_object := case tg_table_name when 'client' then 'contact' else 'deal' end;
  insert into public.hubspot_sync_log (developer_id, direction, object_type, entity, entity_id, status, client_token, payload)
  values (
    new.developer_id, 'outbound', v_object, tg_table_name, new.id, 'pending',
    encode(gen_random_bytes(16), 'hex'),
    jsonb_build_object('event', tg_op, 'snapshot', to_jsonb(new))
  );
  return new;
end;
$$;

create trigger trg_hubspot_client after insert or update on public.client
  for each row execute function public.enqueue_hubspot_event();
create trigger trg_hubspot_quote after insert or update of status on public.quote
  for each row execute function public.enqueue_hubspot_event();

-- ---------- Backfill de desarrollo ----------
-- Cotizaciones de canal broker creadas antes de este motor.
insert into public.commission (developer_id, quote_id, broker_id, project_id, base_pct, amount_mxn, milestone, status, earned_at, target_pay_date)
select
  q.developer_id, q.id, q.broker_id, u.project_id,
  public.commission_base_pct(q.broker_id, u.project_id),
  round(q.net_price_mxn * public.commission_base_pct(q.broker_id, u.project_id) / 100, 2),
  'reserved',
  case when q.status in ('reserved', 'promised', 'won') then 'earned'::public.commission_status
       when q.status in ('expired', 'cancelled') then 'cancelled'::public.commission_status
       else 'accruing'::public.commission_status end,
  case when q.status in ('reserved', 'promised', 'won') then now() end,
  case when q.status in ('reserved', 'promised', 'won') then (now() + interval '30 days')::date end
from public.quote q
join public.unit u on u.id = q.unit_id
where q.channel = 'broker' and q.broker_id is not null
on conflict (quote_id) do nothing;
