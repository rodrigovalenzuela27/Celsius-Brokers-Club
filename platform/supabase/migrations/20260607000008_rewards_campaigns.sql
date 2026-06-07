-- ============================================================
-- Celsius Platform · Fase 6 · Celsius Rewards + Campañas
--
-- Rewards (prototipo §10 broker / §09 admin):
--   · puntos por hitos del pipeline (trigger sobre quote)
--   · tiers por puntos acumulados (no bajan al canjear)
--   · el tier MEJORA la comisión (bono % integrado al motor)
--   · catálogo de canje con stock y tier mínimo
-- Campañas (prototipo §09 broker / §10 admin):
--   · pop-ups y banners por audiencia (brokers / clientes / ambos)
-- ============================================================

-- ---------- Tiers ----------
create table public.reward_tier (
  id                   uuid primary key default gen_random_uuid(),
  developer_id         uuid not null references public.developer (id),
  slug                 text not null,
  name                 text not null,
  min_points           int not null,
  commission_bonus_pct numeric(4,2) not null default 0,
  sort                 int not null default 0,
  unique (developer_id, slug)
);
alter table public.reward_tier enable row level security;
create policy reward_tier_select on public.reward_tier
  for select to authenticated
  using (developer_id = public.current_developer_id());

-- ---------- Eventos de puntos (append-only vía triggers/funciones) ----------
create table public.reward_event (
  id           bigint generated always as identity primary key,
  developer_id uuid not null references public.developer (id),
  broker_id    uuid not null references public.profile (id),
  points       int not null,
  concept      text not null,
  entity       text,
  entity_id    uuid,
  created_at   timestamptz not null default now()
);
create index idx_reward_event_broker on public.reward_event (broker_id);
alter table public.reward_event enable row level security;
create policy reward_event_select on public.reward_event
  for select to authenticated
  using (
    developer_id = public.current_developer_id()
    and (broker_id = auth.uid() or public.is_admin())
  );

-- ---------- Catálogo de canje ----------
create table public.reward_item (
  id            uuid primary key default gen_random_uuid(),
  developer_id  uuid not null references public.developer (id),
  title         text not null,
  description   text,
  points_cost   int not null check (points_cost > 0),
  stock         int,                     -- null = ilimitado
  min_tier_slug text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.reward_item enable row level security;
create policy reward_item_select on public.reward_item
  for select to authenticated
  using (developer_id = public.current_developer_id());
create policy reward_item_admin_write on public.reward_item
  for all to authenticated
  using (developer_id = public.current_developer_id() and public.is_admin())
  with check (developer_id = public.current_developer_id() and public.is_admin());

create table public.reward_redemption (
  id           uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer (id),
  broker_id    uuid not null references public.profile (id),
  item_id      uuid not null references public.reward_item (id),
  points_spent int not null,
  status       text not null default 'requested',  -- requested | delivered | cancelled
  created_at   timestamptz not null default now()
);
alter table public.reward_redemption enable row level security;
create policy reward_redemption_select on public.reward_redemption
  for select to authenticated
  using (
    developer_id = public.current_developer_id()
    and (broker_id = auth.uid() or public.is_admin())
  );

-- ---------- Funciones de consulta ----------
-- Puntos acumulados (histórico, define el tier — no baja al canjear).
create or replace function public.reward_points_total(p_broker uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(points), 0)::int from public.reward_event where broker_id = p_broker;
$$;

-- Saldo canjeable = acumulado − canjes vigentes.
create or replace function public.reward_balance(p_broker uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select public.reward_points_total(p_broker)
       - coalesce((select sum(points_spent) from public.reward_redemption
                   where broker_id = p_broker and status <> 'cancelled'), 0)::int;
$$;

create or replace function public.reward_tier_for(p_broker uuid)
returns public.reward_tier
language sql
stable
security definer
set search_path = public
as $$
  select t.* from public.reward_tier t
  join public.profile pr on pr.developer_id = t.developer_id
  where pr.id = p_broker
    and t.min_points <= public.reward_points_total(p_broker)
  order by t.min_points desc
  limit 1;
$$;

-- Leaderboard (definer: expone solo nombre + puntos del trimestre).
create or replace function public.reward_leaderboard()
returns table (full_name text, points bigint, tier_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.full_name,
         coalesce(sum(e.points), 0) as points,
         (public.reward_tier_for(p.id)).name as tier_name
  from public.profile p
  left join public.reward_event e
    on e.broker_id = p.id and e.created_at >= date_trunc('quarter', now())
  where p.developer_id = public.current_developer_id()
    and p.role in ('broker_internal', 'broker_external')
    and p.active
  group by p.id, p.full_name
  order by points desc
  limit 10;
$$;

grant execute on function public.reward_points_total to authenticated;
grant execute on function public.reward_balance to authenticated;
grant execute on function public.reward_tier_for to authenticated;
grant execute on function public.reward_leaderboard to authenticated;

-- ---------- Canje ----------
create or replace function public.redeem_reward(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.reward_item%rowtype;
  v_balance int;
  v_tier public.reward_tier;
  v_min_tier public.reward_tier%rowtype;
begin
  if not public.is_broker() then
    return jsonb_build_object('error', 'Solo brokers pueden canjear');
  end if;

  select * into v_item from public.reward_item
    where id = p_item_id and active for update;
  if not found then
    return jsonb_build_object('error', 'Recompensa no disponible');
  end if;
  if v_item.stock is not null and v_item.stock < 1 then
    return jsonb_build_object('error', 'Sin stock');
  end if;

  v_balance := public.reward_balance(auth.uid());
  if v_balance < v_item.points_cost then
    return jsonb_build_object('error',
      format('Saldo insuficiente: tienes %s pts y cuesta %s', v_balance, v_item.points_cost));
  end if;

  if v_item.min_tier_slug is not null then
    v_tier := public.reward_tier_for(auth.uid());
    select * into v_min_tier from public.reward_tier
      where developer_id = v_item.developer_id and slug = v_item.min_tier_slug;
    if v_tier.min_points is null or v_tier.min_points < v_min_tier.min_points then
      return jsonb_build_object('error',
        format('Requiere tier %s o superior', v_min_tier.name));
    end if;
  end if;

  if v_item.stock is not null then
    update public.reward_item set stock = stock - 1 where id = v_item.id;
  end if;

  insert into public.reward_redemption (developer_id, broker_id, item_id, points_spent)
  values (v_item.developer_id, auth.uid(), v_item.id, v_item.points_cost);

  return jsonb_build_object('ok', true, 'item', v_item.title, 'points', v_item.points_cost);
end;
$$;
grant execute on function public.redeem_reward to authenticated;

-- ---------- Puntos por hitos del pipeline ----------
create or replace function public.award_reward_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.channel <> 'broker' or new.broker_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.reward_event (developer_id, broker_id, points, concept, entity, entity_id) values
      (new.developer_id, new.broker_id, 10, 'Cotización emitida · ' || new.folio, 'quote', new.id),
      (new.developer_id, new.broker_id, 50, 'Apartado 24h · ' || new.folio, 'quote', new.id);
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    if new.status = 'reserved' then
      insert into public.reward_event (developer_id, broker_id, points, concept, entity, entity_id)
      values (new.developer_id, new.broker_id, 150, 'Reserva confirmada · ' || new.folio, 'quote', new.id);
    elsif new.status = 'won' then
      insert into public.reward_event (developer_id, broker_id, points, concept, entity, entity_id)
      values (new.developer_id, new.broker_id, 500, 'Venta cerrada · ' || new.folio, 'quote', new.id);
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_reward_points after insert or update of status on public.quote
  for each row execute function public.award_reward_points();

-- ---------- Tier bonus integrado al motor de comisiones ----------
alter table public.commission add column tier_bonus_pct numeric(5,2) not null default 0;

create or replace function public.commission_on_quote_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_pct numeric;
  v_bonus numeric;
  v_milestone text;
begin
  if new.channel <> 'broker' or new.broker_id is null then
    return new;
  end if;

  select u.project_id into v_project_id from public.unit u where u.id = new.unit_id;
  v_pct := public.commission_base_pct(new.broker_id, v_project_id);
  v_bonus := coalesce((public.reward_tier_for(new.broker_id)).commission_bonus_pct, 0);
  select coalesce(p.policy_overrides ->> 'commission_milestone', 'reserved')
    into v_milestone from public.project p where p.id = v_project_id;

  insert into public.commission
    (developer_id, quote_id, broker_id, project_id, base_pct, tier_bonus_pct, amount_mxn, milestone)
  values
    (new.developer_id, new.id, new.broker_id, v_project_id,
     v_pct, v_bonus, round(new.net_price_mxn * (v_pct + v_bonus) / 100, 2), v_milestone);
  return new;
end;
$$;

-- ---------- Campañas ----------
create table public.campaign (
  id           uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer (id),
  title        text not null,
  body         text not null,
  cta_label    text,
  cta_href     text,
  format       text not null check (format in ('popup', 'banner')),
  audience     text not null check (audience in ('brokers', 'clients', 'both')),
  active       boolean not null default true,
  starts_at    date not null default current_date,
  ends_at      date,
  created_by   uuid references public.profile (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_campaign_updated_at before update on public.campaign
  for each row execute function public.set_updated_at();
create trigger trg_audit_campaign after insert or update or delete on public.campaign
  for each row execute function public.write_audit_event();

alter table public.campaign enable row level security;

create policy campaign_admin_all on public.campaign
  for all to authenticated
  using (developer_id = public.current_developer_id() and public.is_admin())
  with check (developer_id = public.current_developer_id() and public.is_admin());

create policy campaign_broker_select on public.campaign
  for select to authenticated
  using (
    developer_id = public.current_developer_id()
    and public.is_broker()
    and active
    and audience in ('brokers', 'both')
    and starts_at <= current_date
    and (ends_at is null or ends_at >= current_date)
  );

-- Portal anónimo: solo campañas activas para clientes.
create policy campaign_public_select on public.campaign
  for select to anon
  using (
    active
    and audience in ('clients', 'both')
    and starts_at <= current_date
    and (ends_at is null or ends_at >= current_date)
  );

-- ---------- Backfill de desarrollo ----------
-- Puntos por las cotizaciones existentes (mismo criterio que el trigger).
insert into public.reward_event (developer_id, broker_id, points, concept, entity, entity_id)
select q.developer_id, q.broker_id, v.points, v.concept || ' · ' || q.folio, 'quote', q.id
from public.quote q
cross join lateral (values
  (10, 'Cotización emitida'),
  (50, 'Apartado 24h')
) as v(points, concept)
where q.channel = 'broker' and q.broker_id is not null;

insert into public.reward_event (developer_id, broker_id, points, concept, entity, entity_id)
select q.developer_id, q.broker_id, 150, 'Reserva confirmada · ' || q.folio, 'quote', q.id
from public.quote q
where q.channel = 'broker' and q.broker_id is not null
  and q.status in ('reserved', 'promised', 'won');
