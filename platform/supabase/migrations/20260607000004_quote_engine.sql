-- ============================================================
-- Celsius Platform · Fase 2 · Quote engine + apartado 24h
--
-- Flujo central del doc de arquitectura (§08): generar cotización
-- y apartar la unidad es UNA transacción atómica. El constraint
-- uq_unit_hold_active garantiza a nivel DB que dos brokers no
-- puedan apartar la misma unidad ni con requests simultáneos.
-- ============================================================

-- ---------- Crear cotización + hold (atómico) ----------
-- SECURITY DEFINER: el broker no tiene permiso RLS para actualizar
-- unit.status; esta función es el único camino y valida todo.
create or replace function public.create_quote_with_hold(
  p_unit_id            uuid,
  p_client_id          uuid,
  p_list_price_mxn     numeric,
  p_discounts          jsonb,
  p_net_price_mxn      numeric,
  p_down_payment_pct   numeric,
  p_down_payment_mxn   numeric,
  p_months             int,
  p_monthly_payment_mxn numeric,
  p_balance_at_close_mxn numeric,
  p_payment_schema     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit      public.unit%rowtype;
  v_project   public.project%rowtype;
  v_hold_hours int;
  v_quote_id  uuid;
begin
  if not public.is_broker() then
    raise exception 'Solo brokers pueden generar cotizaciones';
  end if;

  -- Lock pesimista de la unidad: serializa apartados concurrentes.
  select * into v_unit from public.unit where id = p_unit_id for update;
  if not found then
    raise exception 'Unidad no encontrada';
  end if;
  if not public.can_access_project(v_unit.project_id) then
    raise exception 'Sin acceso al proyecto de esta unidad';
  end if;
  if v_unit.status <> 'available' then
    raise exception 'La unidad % ya no está disponible (estado: %)',
      v_unit.unit_number, v_unit.status;
  end if;

  -- El cliente debe pertenecer al broker que cotiza.
  if not exists (
    select 1 from public.client c
    where c.id = p_client_id and c.broker_id = auth.uid()
  ) then
    raise exception 'El cliente no pertenece a tu cartera';
  end if;

  -- El snapshot debe partir del precio vigente: si admin cambió el
  -- precio entre que el broker vio la unidad y envió, se rechaza.
  if p_list_price_mxn is distinct from v_unit.list_price_mxn then
    raise exception 'El precio de lista cambió; vuelve a generar la cotización';
  end if;
  if p_net_price_mxn <= 0 or p_net_price_mxn > v_unit.list_price_mxn then
    raise exception 'Precio neto inválido';
  end if;

  select * into v_project from public.project where id = v_unit.project_id;
  v_hold_hours := coalesce((v_project.policy_overrides ->> 'hold_hours')::int, 24);

  insert into public.quote (
    developer_id, unit_id, client_id, broker_id, status,
    list_price_mxn, discounts, net_price_mxn,
    down_payment_pct, down_payment_mxn,
    months, monthly_payment_mxn, balance_at_close_mxn,
    payment_schema, valid_until, sent_at
  ) values (
    v_project.developer_id, p_unit_id, p_client_id, auth.uid(), 'hold_active',
    v_unit.list_price_mxn, p_discounts, p_net_price_mxn,
    p_down_payment_pct, p_down_payment_mxn,
    p_months, p_monthly_payment_mxn, p_balance_at_close_mxn,
    p_payment_schema, now() + interval '7 days', now()
  )
  returning id into v_quote_id;

  -- uq_unit_hold_active hace imposible un segundo hold activo.
  insert into public.unit_hold (unit_id, quote_id, broker_id, expires_at)
  values (p_unit_id, v_quote_id, auth.uid(), now() + make_interval(hours => v_hold_hours));

  update public.unit set status = 'held' where id = p_unit_id;

  return v_quote_id;
end;
$$;

-- ---------- Liberar un apartado (manual: broker dueño o admin) ----------
create or replace function public.release_hold(p_hold_id uuid, p_reason text default 'cancelled')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.unit_hold%rowtype;
begin
  select * into v_hold from public.unit_hold where id = p_hold_id for update;
  if not found or v_hold.released_at is not null then
    raise exception 'El apartado no existe o ya fue liberado';
  end if;
  if v_hold.broker_id <> auth.uid() and not public.is_admin() then
    raise exception 'Sin permiso para liberar este apartado';
  end if;

  update public.unit_hold set released_at = now() where id = p_hold_id;
  update public.unit set status = 'available'
    where id = v_hold.unit_id and status = 'held';
  update public.quote
    set status = (case when p_reason = 'expired' then 'expired' else 'cancelled' end)::public.quote_status
    where id = v_hold.quote_id and status = 'hold_active';
end;
$$;

-- ---------- Expirar holds vencidos (cron) ----------
create or replace function public.expire_unit_holds()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    select id, unit_id, quote_id from public.unit_hold
    where released_at is null and reserved_at is null and expires_at < now()
    for update skip locked
  loop
    update public.unit_hold set released_at = now() where id = r.id;
    update public.unit set status = 'available'
      where id = r.unit_id and status = 'held';
    update public.quote set status = 'expired'
      where id = r.quote_id and status = 'hold_active';
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.create_quote_with_hold to authenticated;
grant execute on function public.release_hold to authenticated;
-- expire_unit_holds solo lo invoca el cron (postgres) o service role.
revoke execute on function public.expire_unit_holds from public, anon, authenticated;

-- ---------- Cron: liberar holds expirados cada minuto (§08 paso 07) ----------
-- pg_cron está disponible en Supabase (local y cloud). Si la extensión
-- no existiera en algún entorno, la migración no truena: queda el
-- fallback de invocar expire_unit_holds() desde un job externo.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'expire-unit-holds',
    '* * * * *',
    $job$ select public.expire_unit_holds(); $job$
  );
exception when others then
  raise notice 'pg_cron no disponible (%) — programar expire_unit_holds() externamente', sqlerrm;
end;
$$;
