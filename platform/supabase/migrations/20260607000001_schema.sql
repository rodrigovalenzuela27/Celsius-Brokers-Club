-- ============================================================
-- Celsius Platform · Fase 0 · Schema base
-- 10 entidades del documento de arquitectura (CELS-COT-2026.05)
-- + profile/brokerage para auth con roles.
-- ============================================================

-- ---------- Extensiones ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type public.user_role as enum (
  'admin',            -- administración Celsius
  'broker_internal',  -- broker interno Celsius
  'broker_external',  -- broker de inmobiliaria con convenio
  'client'            -- cliente final (portal, v2)
);

create type public.project_status as enum ('presale', 'selling', 'sold_out', 'delivered');

create type public.unit_status as enum ('available', 'held', 'reserved', 'sold', 'inactive');

create type public.quote_status as enum (
  'draft',        -- creada, no enviada (mutable)
  'sent',         -- PDF enviado al cliente (inmutable desde aquí)
  'hold_active',  -- apartado 24h corriendo
  'reserved',     -- cliente confirmó / pagó enganche
  'promised',     -- promesa firmada (Mifiel, v2)
  'won',          -- escriturada
  'expired',      -- apartado venció sin confirmación
  'cancelled'     -- cliente desistió
);

create type public.asset_type as enum (
  'brochure', 'brand_manual', 'social_template', 'render',
  'floor_plan', 'video', 'building_svg', 'quote_pdf', 'document', 'other'
);

create type public.sync_direction as enum ('outbound', 'inbound');

create type public.sync_status as enum ('pending', 'success', 'failed', 'retrying', 'manual');

-- ---------- Trigger genérico updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================
-- ENTIDADES MAESTRAS
-- ============================================================

-- DEVELOPER · identidad de la desarrolladora (multi-tenant ready)
create table public.developer (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  brand_tokens        jsonb not null default '{}'::jsonb,
  hubspot_account_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_developer_updated_at before update on public.developer
  for each row execute function public.set_updated_at();

-- BROKERAGE · inmobiliaria externa con convenio
create table public.brokerage (
  id            uuid primary key default gen_random_uuid(),
  developer_id  uuid not null references public.developer (id),
  name          text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- PROFILE · usuario de la plataforma (1:1 con auth.users)
create table public.profile (
  id                uuid primary key references auth.users (id) on delete cascade,
  developer_id      uuid not null references public.developer (id),
  role              public.user_role not null default 'client',
  full_name         text not null default '',
  email             text not null,
  phone             text,
  brokerage_id      uuid references public.brokerage (id),
  hubspot_owner_id  text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- un broker externo siempre pertenece a una inmobiliaria
  constraint external_broker_has_brokerage
    check (role <> 'broker_external' or brokerage_id is not null)
);
create trigger trg_profile_updated_at before update on public.profile
  for each row execute function public.set_updated_at();

-- PROJECT · desarrollo inmobiliario (Solar, Atrio, Cima)
create table public.project (
  id             uuid primary key default gen_random_uuid(),
  developer_id   uuid not null references public.developer (id),
  code           text not null,
  name           text not null,
  location       text not null default '',
  address        text,
  status         public.project_status not null default 'presale',
  delivery_date  date,
  levels         int,
  tech_specs     jsonb not null default '{}'::jsonb,
  -- overrides locales sobre políticas globales (fase 4)
  policy_overrides jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (developer_id, code)
);
create trigger trg_project_updated_at before update on public.project
  for each row execute function public.set_updated_at();

-- BROKERAGE_PROJECT_ACCESS · convenios: qué proyectos ve cada inmobiliaria
create table public.brokerage_project_access (
  brokerage_id  uuid not null references public.brokerage (id) on delete cascade,
  project_id    uuid not null references public.project (id) on delete cascade,
  commission_pct numeric(5,2),  -- override del % convenio para este proyecto
  created_at    timestamptz not null default now(),
  primary key (brokerage_id, project_id)
);

-- UNIT · departamento individual
create table public.unit (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.project (id),
  unit_number     text not null,
  floor           int not null,
  m2              numeric(8,2) not null,
  bedrooms        int not null,
  bathrooms       numeric(3,1) not null,
  parking_spots   int not null default 0,
  has_storage     boolean not null default false,
  orientation     text,
  view_description text,
  list_price_mxn  numeric(14,2) not null check (list_price_mxn > 0),
  status          public.unit_status not null default 'available',
  -- coordenadas del polígono en el SVG del edificio (visualizador)
  svg_coords      jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, unit_number)
);
create index idx_unit_project_status on public.unit (project_id, status);
create trigger trg_unit_updated_at before update on public.unit
  for each row execute function public.set_updated_at();

-- ASSET · archivo binario (brochure, render, SVG, PDF de cotización)
create table public.asset (
  id            uuid primary key default gen_random_uuid(),
  developer_id  uuid not null references public.developer (id),
  project_id    uuid references public.project (id),
  type          public.asset_type not null,
  title         text not null,
  storage_path  text not null,
  version       int not null default 1,
  tags          text[] not null default '{}',
  created_by    uuid references public.profile (id),
  created_at    timestamptz not null default now()
);
create index idx_asset_project on public.asset (project_id);

-- CLIENT · cliente final dado de alta por un broker
create table public.client (
  id                  uuid primary key default gen_random_uuid(),
  developer_id        uuid not null references public.developer (id),
  broker_id           uuid not null references public.profile (id),
  full_name           text not null,
  email               text not null,
  phone               text,
  rfc                 text,
  curp                text,
  hubspot_contact_id  text,
  -- LFPDPPP: fecha y versión del aviso de privacidad aceptado
  consent_at          timestamptz,
  consent_version     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_client_broker on public.client (broker_id);
create trigger trg_client_updated_at before update on public.client
  for each row execute function public.set_updated_at();

-- ============================================================
-- ENTIDADES TRANSACCIONALES
-- ============================================================

-- Folio secuencial de cotizaciones (Q-2614, ...)
create sequence public.quote_folio_seq start 1000;

-- QUOTE · cotización emitida. Inmutable después de enviada.
create table public.quote (
  id                   uuid primary key default gen_random_uuid(),
  folio                text not null unique
                       default ('Q-' || nextval('public.quote_folio_seq')::text),
  developer_id         uuid not null references public.developer (id),
  unit_id              uuid not null references public.unit (id),
  client_id            uuid not null references public.client (id),
  broker_id            uuid not null references public.profile (id),
  status               public.quote_status not null default 'draft',
  -- snapshot financiero al momento de emitir (no se recalcula)
  list_price_mxn       numeric(14,2) not null,
  discounts            jsonb not null default '[]'::jsonb,
  net_price_mxn        numeric(14,2) not null,
  down_payment_pct     numeric(5,2) not null,
  down_payment_mxn     numeric(14,2) not null,
  months               int not null default 0,
  monthly_payment_mxn  numeric(14,2) not null default 0,
  balance_at_close_mxn numeric(14,2) not null default 0,
  payment_schema       jsonb not null default '{}'::jsonb,
  pdf_asset_id         uuid references public.asset (id),
  hubspot_deal_id      text,
  valid_until          timestamptz,
  sent_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_quote_broker on public.quote (broker_id);
create index idx_quote_unit on public.quote (unit_id);
create index idx_quote_status on public.quote (status);
create trigger trg_quote_updated_at before update on public.quote
  for each row execute function public.set_updated_at();

-- Invariante: el snapshot financiero de una QUOTE es inmutable después de 'draft'.
-- Solo pueden cambiar: status, pdf_asset_id, hubspot_deal_id, sent_at, valid_until.
create or replace function public.enforce_quote_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'draft' and (
    new.unit_id              is distinct from old.unit_id or
    new.client_id            is distinct from old.client_id or
    new.broker_id            is distinct from old.broker_id or
    new.list_price_mxn       is distinct from old.list_price_mxn or
    new.discounts            is distinct from old.discounts or
    new.net_price_mxn        is distinct from old.net_price_mxn or
    new.down_payment_pct     is distinct from old.down_payment_pct or
    new.down_payment_mxn     is distinct from old.down_payment_mxn or
    new.months               is distinct from old.months or
    new.monthly_payment_mxn  is distinct from old.monthly_payment_mxn or
    new.balance_at_close_mxn is distinct from old.balance_at_close_mxn or
    new.payment_schema       is distinct from old.payment_schema
  ) then
    raise exception 'QUOTE % es inmutable después de enviarse (status=%)', old.folio, old.status;
  end if;
  return new;
end;
$$;
create trigger trg_quote_immutable before update on public.quote
  for each row execute function public.enforce_quote_immutability();

-- UNIT_HOLD · apartado 24h. Tabla separada (historial de N holds por unidad).
create table public.unit_hold (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.unit (id),
  quote_id     uuid not null references public.quote (id),
  broker_id    uuid not null references public.profile (id),
  expires_at   timestamptz not null,
  reserved_at  timestamptz,
  released_at  timestamptz,
  created_at   timestamptz not null default now()
);
-- Invariante crítico: solo UN hold activo por unidad, garantizado a nivel DB.
create unique index uq_unit_hold_active
  on public.unit_hold (unit_id)
  where released_at is null;
create index idx_unit_hold_expiry
  on public.unit_hold (expires_at)
  where released_at is null and reserved_at is null;

-- AUDIT_EVENT · registro append-only de toda mutación sensible
create table public.audit_event (
  id          bigint generated always as identity primary key,
  developer_id uuid references public.developer (id),
  actor_id    uuid,                       -- profile.id o null si sistema
  actor_type  text not null default 'user', -- user | system | webhook | cron
  action      text not null,              -- INSERT | UPDATE | DELETE
  entity      text not null,              -- nombre de tabla
  entity_id   text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index idx_audit_entity on public.audit_event (entity, entity_id);
create index idx_audit_created on public.audit_event (created_at desc);

-- Append-only: prohibido UPDATE/DELETE incluso para owner de la app
create or replace function public.audit_event_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'AUDIT_EVENT es append-only';
end;
$$;
create trigger trg_audit_no_update before update or delete on public.audit_event
  for each row execute function public.audit_event_immutable();

-- Trigger genérico de auditoría para tablas sensibles
create or replace function public.write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  dev uuid;
begin
  rec := coalesce(new, old);
  begin
    dev := rec.developer_id;
  exception when undefined_column then
    dev := null;
  end;
  insert into public.audit_event (developer_id, actor_id, actor_type, action, entity, entity_id, payload)
  values (
    dev,
    auth.uid(),
    case when auth.uid() is null then 'system' else 'user' end,
    tg_op,
    tg_table_name,
    rec.id::text,
    case tg_op
      when 'DELETE' then jsonb_build_object('old', to_jsonb(old))
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      else jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_quote after insert or update or delete on public.quote
  for each row execute function public.write_audit_event();
create trigger trg_audit_unit_hold after insert or update or delete on public.unit_hold
  for each row execute function public.write_audit_event();
create trigger trg_audit_client after insert or update or delete on public.client
  for each row execute function public.write_audit_event();
create trigger trg_audit_unit after update or delete on public.unit
  for each row execute function public.write_audit_event();
create trigger trg_audit_project after update or delete on public.project
  for each row execute function public.write_audit_event();

-- HUBSPOT_SYNC_LOG · bitácora de cada operación de sync (idempotencia + reintentos)
create table public.hubspot_sync_log (
  id            uuid primary key default gen_random_uuid(),
  developer_id  uuid not null references public.developer (id),
  direction     public.sync_direction not null,
  object_type   text not null,           -- contact | deal | note | task
  entity        text,                    -- tabla local (client, quote, ...)
  entity_id     uuid,
  hubspot_id    text,
  status        public.sync_status not null default 'pending',
  attempts      int not null default 0,
  last_error    text,
  -- token de idempotencia: reintentos no duplican contacts ni deals
  client_token  text not null unique,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_sync_status on public.hubspot_sync_log (status) where status in ('pending','retrying','failed');
create trigger trg_sync_updated_at before update on public.hubspot_sync_log
  for each row execute function public.set_updated_at();

-- ============================================================
-- AUTH · creación y sync automático de profile
-- ============================================================
-- El developer default se resuelve por slug 'celsius' (seed).
-- El rol vive en raw_app_meta_data.role — solo modificable vía Admin API
-- (service role), nunca por el usuario. Un signup público entra como
-- 'client'. GoTrue puede aplicar app_metadata en un UPDATE posterior al
-- INSERT, por eso el trigger cubre ambos eventos con upsert.
create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_dev uuid;
  assigned_role public.user_role;
begin
  select id into default_dev from public.developer where slug = 'celsius' limit 1;

  assigned_role := coalesce(
    (new.raw_app_meta_data ->> 'role')::public.user_role,
    'client'
  );

  insert into public.profile (id, developer_id, role, full_name, email, brokerage_id)
  values (
    new.id,
    default_dev,
    assigned_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    -- broker externo: la invitación del admin trae su inmobiliaria
    (new.raw_app_meta_data ->> 'brokerage_id')::uuid
  )
  on conflict (id) do update
    set role = excluded.role,
        brokerage_id = excluded.brokerage_id,
        email = excluded.email;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user();

create trigger trg_on_auth_user_updated
  after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_auth_user();
