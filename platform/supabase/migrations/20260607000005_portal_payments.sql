-- ============================================================
-- Celsius Platform · Fase 3 · Portal público + pagos
--
-- 1. Canal directo: el cliente compra sin broker (bono +1%).
--    quote/client/unit_hold permiten broker_id NULL en ese canal.
-- 2. Códigos de cotización: el broker comparte un código de 6
--    dígitos (15 min); el cliente lo canjea por un token de acceso
--    (24h) sin necesidad de cuenta.
-- 3. PAYMENT: registro del cobro de enganche. El proveedor es un
--    adapter (mock hoy, Stripe al conectar keys); la reserva se
--    confirma en la misma transacción que el pago.
-- ============================================================

-- ---------- Canal directo ----------
alter table public.client alter column broker_id drop not null;

alter table public.quote alter column broker_id drop not null;
alter table public.quote add column channel text not null default 'broker'
  check (channel in ('broker', 'direct'));
alter table public.quote add constraint quote_channel_broker
  check (channel = 'direct' or broker_id is not null);

alter table public.unit_hold alter column broker_id drop not null;

-- ---------- Catálogo público ----------
-- El portal es la cara pública de venta: proyectos en comercialización
-- y sus unidades son visibles sin sesión (anon) y para usuarios con
-- rol client. Lo transaccional sigue cerrado.
create policy project_public_select on public.project
  for select to anon
  using (status in ('presale', 'selling'));

create policy unit_public_select on public.unit
  for select to anon
  using (exists (
    select 1 from public.project p
    where p.id = project_id and p.status in ('presale', 'selling')
  ));

create policy project_client_select on public.project
  for select to authenticated
  using (
    public.current_profile_role() = 'client'
    and status in ('presale', 'selling')
  );

create policy unit_client_select on public.unit
  for select to authenticated
  using (
    public.current_profile_role() = 'client'
    and exists (
      select 1 from public.project p
      where p.id = project_id and p.status in ('presale', 'selling')
    )
  );

-- ---------- QUOTE_ACCESS_CODE ----------
-- Sin policies: solo las funciones security definer la tocan.
create table public.quote_access_code (
  id               uuid primary key default gen_random_uuid(),
  quote_id         uuid not null references public.quote (id),
  code_hash        text not null,            -- sha256 del código de 6 dígitos
  expires_at       timestamptz not null,     -- vigencia del código (15 min)
  used_at          timestamptz,
  access_token     text unique,              -- emitido al canjear
  token_expires_at timestamptz,              -- vigencia del acceso (24 h)
  created_at       timestamptz not null default now()
);
create index idx_qac_quote on public.quote_access_code (quote_id);
alter table public.quote_access_code enable row level security;

-- ---------- PAYMENT ----------
create type public.payment_status as enum
  ('pending', 'processing', 'succeeded', 'failed', 'refunded');

create table public.payment (
  id                  uuid primary key default gen_random_uuid(),
  developer_id        uuid not null references public.developer (id),
  quote_id            uuid not null references public.quote (id),
  amount_mxn          numeric(14,2) not null check (amount_mxn > 0),
  processing_fee_mxn  numeric(14,2) not null default 0,
  provider            text not null,            -- mock | stripe
  provider_payment_id text not null,
  status              public.payment_status not null default 'pending',
  method              text,                     -- 'card •••• 4242'
  client_token        text not null unique,     -- idempotencia
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_payment_quote on public.payment (quote_id);
create trigger trg_payment_updated_at before update on public.payment
  for each row execute function public.set_updated_at();
create trigger trg_audit_payment after insert or update on public.payment
  for each row execute function public.write_audit_event();

alter table public.payment enable row level security;

create policy payment_select on public.payment
  for select to authenticated
  using (
    developer_id = public.current_developer_id()
    and (
      public.is_admin()
      or exists (
        select 1 from public.quote q
        where q.id = quote_id and q.broker_id = auth.uid()
      )
    )
  );

-- ============================================================
-- FUNCIONES
-- ============================================================

-- Broker/admin genera el código de 6 dígitos para compartir (15 min).
create or replace function public.create_quote_access_code(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_quote public.quote%rowtype;
  v_code text;
  v_expires timestamptz;
begin
  select * into v_quote from public.quote where id = p_quote_id;
  if not found then
    raise exception 'Cotización no encontrada';
  end if;
  if v_quote.broker_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Solo el broker dueño puede compartir esta cotización';
  end if;
  if v_quote.status not in ('sent', 'hold_active', 'reserved') then
    raise exception 'La cotización no está en un estado compartible (%)', v_quote.status;
  end if;

  v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
  v_expires := now() + interval '15 minutes';

  -- Un solo código pendiente por cotización.
  delete from public.quote_access_code
    where quote_id = p_quote_id and used_at is null;

  insert into public.quote_access_code (quote_id, code_hash, expires_at)
  values (p_quote_id, encode(digest(v_code, 'sha256'), 'hex'), v_expires);

  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end;
$$;

-- El cliente canjea email + código por un token de acceso de 24 h.
create or replace function public.redeem_quote_access_code(p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rec record;
  v_token text;
begin
  select qac.id, qac.quote_id into v_rec
  from public.quote_access_code qac
  join public.quote q on q.id = qac.quote_id
  join public.client c on c.id = q.client_id
  where qac.code_hash = encode(digest(p_code, 'sha256'), 'hex')
    and qac.used_at is null
    and qac.expires_at > now()
    and lower(c.email) = lower(trim(p_email))
  order by qac.created_at desc
  limit 1;

  if not found then
    raise exception 'Código inválido, expirado o el correo no coincide';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');
  update public.quote_access_code
    set used_at = now(),
        access_token = v_token,
        token_expires_at = now() + interval '24 hours'
    where id = v_rec.id;

  return jsonb_build_object('quote_id', v_rec.quote_id, 'token', v_token);
end;
$$;

-- ¿Token válido para esta cotización? (helper interno)
create or replace function public.validate_quote_token(p_quote_id uuid, p_token text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.quote_access_code
    where quote_id = p_quote_id
      and access_token = p_token
      and token_expires_at > now()
  );
$$;

-- Vista de la cotización para el cliente (anon con token).
create or replace function public.get_shared_quote(p_quote_id uuid, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v jsonb;
begin
  if not public.validate_quote_token(p_quote_id, p_token) then
    raise exception 'Acceso inválido o expirado';
  end if;

  select jsonb_build_object(
    'id', q.id,
    'folio', q.folio,
    'status', q.status,
    'channel', q.channel,
    'list_price_mxn', q.list_price_mxn,
    'discounts', q.discounts,
    'net_price_mxn', q.net_price_mxn,
    'down_payment_pct', q.down_payment_pct,
    'down_payment_mxn', q.down_payment_mxn,
    'months', q.months,
    'monthly_payment_mxn', q.monthly_payment_mxn,
    'balance_at_close_mxn', q.balance_at_close_mxn,
    'valid_until', q.valid_until,
    'created_at', q.created_at,
    'client', jsonb_build_object('full_name', c.full_name, 'email', c.email),
    'unit', jsonb_build_object(
      'unit_number', u.unit_number, 'floor', u.floor, 'm2', u.m2,
      'bedrooms', u.bedrooms, 'bathrooms', u.bathrooms
    ),
    'project', jsonb_build_object('name', p.name, 'code', p.code),
    'hold_expires_at', (
      select h.expires_at from public.unit_hold h
      where h.quote_id = q.id and h.released_at is null and h.reserved_at is null
      limit 1
    ),
    'paid', exists (
      select 1 from public.payment pay
      where pay.quote_id = q.id and pay.status = 'succeeded'
    )
  ) into v
  from public.quote q
  join public.client c on c.id = q.client_id
  join public.unit u on u.id = q.unit_id
  join public.project p on p.id = u.project_id
  where q.id = p_quote_id;

  return v;
end;
$$;

-- Compra directa: cliente sin cuenta cotiza y aparta (bono +1%).
create or replace function public.create_direct_quote(
  p_unit_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_rfc text,
  p_consent boolean,
  p_list_price_mxn numeric,
  p_discounts jsonb,
  p_net_price_mxn numeric,
  p_down_payment_pct numeric,
  p_down_payment_mxn numeric,
  p_months int,
  p_monthly_payment_mxn numeric,
  p_balance_at_close_mxn numeric,
  p_payment_schema jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_unit public.unit%rowtype;
  v_project public.project%rowtype;
  v_client_id uuid;
  v_quote_id uuid;
  v_token text;
  v_hold_hours int;
begin
  if not p_consent then
    raise exception 'Se requiere aceptar el aviso de privacidad';
  end if;

  select * into v_unit from public.unit where id = p_unit_id for update;
  if not found then
    raise exception 'Unidad no encontrada';
  end if;
  if v_unit.status <> 'available' then
    raise exception 'La unidad % ya no está disponible', v_unit.unit_number;
  end if;

  select * into v_project from public.project where id = v_unit.project_id;
  if v_project.status not in ('presale', 'selling') then
    raise exception 'El proyecto no está en comercialización';
  end if;
  if p_list_price_mxn is distinct from v_unit.list_price_mxn then
    raise exception 'El precio de lista cambió; vuelve a generar la cotización';
  end if;
  if p_net_price_mxn <= 0 or p_net_price_mxn > v_unit.list_price_mxn then
    raise exception 'Precio neto inválido';
  end if;

  v_hold_hours := coalesce((v_project.policy_overrides ->> 'hold_hours')::int, 24);

  insert into public.client (developer_id, broker_id, full_name, email, phone, rfc, consent_at, consent_version)
  values (v_project.developer_id, null, p_full_name, lower(trim(p_email)), nullif(p_phone, ''), nullif(upper(p_rfc), ''), now(), 'v3.2')
  returning id into v_client_id;

  insert into public.quote (
    developer_id, unit_id, client_id, broker_id, channel, status,
    list_price_mxn, discounts, net_price_mxn,
    down_payment_pct, down_payment_mxn,
    months, monthly_payment_mxn, balance_at_close_mxn,
    payment_schema, valid_until, sent_at
  ) values (
    v_project.developer_id, p_unit_id, v_client_id, null, 'direct', 'hold_active',
    v_unit.list_price_mxn, p_discounts, p_net_price_mxn,
    p_down_payment_pct, p_down_payment_mxn,
    p_months, p_monthly_payment_mxn, p_balance_at_close_mxn,
    p_payment_schema, now() + interval '7 days', now()
  )
  returning id into v_quote_id;

  insert into public.unit_hold (unit_id, quote_id, broker_id, expires_at)
  values (p_unit_id, v_quote_id, null, now() + make_interval(hours => v_hold_hours));

  update public.unit set status = 'held' where id = p_unit_id;

  -- Token de acceso emitido directamente (el cliente no tiene cuenta).
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.quote_access_code (quote_id, code_hash, expires_at, used_at, access_token, token_expires_at)
  values (v_quote_id, 'direct', now(), now(), v_token, now() + interval '24 hours');

  return jsonb_build_object('quote_id', v_quote_id, 'token', v_token);
end;
$$;

-- Pago del enganche + confirmación de reserva (transacción única).
-- El monto NO viene del cliente: se recalcula aquí (enganche + fee 1.5%).
create or replace function public.record_payment_and_reserve(
  p_quote_id uuid,
  p_token text,
  p_provider text,
  p_provider_payment_id text,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_quote public.quote%rowtype;
  v_hold public.unit_hold%rowtype;
  v_fee numeric;
  v_amount numeric;
  v_payment_id uuid;
begin
  if not public.validate_quote_token(p_quote_id, p_token) then
    raise exception 'Acceso inválido o expirado';
  end if;

  select * into v_quote from public.quote where id = p_quote_id for update;
  if v_quote.status <> 'hold_active' then
    raise exception 'La cotización no admite pago (estado: %)', v_quote.status;
  end if;

  select * into v_hold from public.unit_hold
    where quote_id = p_quote_id and released_at is null and reserved_at is null
    for update;
  if not found then
    raise exception 'El apartado ya no está activo';
  end if;
  if v_hold.expires_at < now() then
    raise exception 'El apartado expiró; la unidad fue liberada';
  end if;

  v_fee := round(v_quote.down_payment_mxn * 0.015, 2);
  v_amount := v_quote.down_payment_mxn + v_fee;

  insert into public.payment (
    developer_id, quote_id, amount_mxn, processing_fee_mxn,
    provider, provider_payment_id, status, method, client_token
  ) values (
    v_quote.developer_id, p_quote_id, v_amount, v_fee,
    p_provider, p_provider_payment_id, 'succeeded', p_method,
    encode(gen_random_bytes(16), 'hex')
  )
  returning id into v_payment_id;

  update public.unit_hold set reserved_at = now() where id = v_hold.id;
  update public.unit set status = 'reserved' where id = v_quote.unit_id;
  update public.quote set status = 'reserved' where id = p_quote_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'amount_mxn', v_amount,
    'fee_mxn', v_fee,
    'folio', v_quote.folio
  );
end;
$$;

-- ---------- Grants ----------
grant execute on function public.create_quote_access_code to authenticated;
grant execute on function public.redeem_quote_access_code to anon, authenticated;
grant execute on function public.get_shared_quote to anon, authenticated;
grant execute on function public.create_direct_quote to anon, authenticated;
grant execute on function public.record_payment_and_reserve to anon, authenticated;
revoke execute on function public.validate_quote_token from public, anon, authenticated;
