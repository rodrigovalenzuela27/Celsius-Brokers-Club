-- ============================================================
-- Celsius Platform · Fase 5 · Solicitudes de broker + hardening
--
-- 1. BROKER_APPLICATION: queue de aspirantes (Ruta C del portal)
--    con documentos adjuntos. Los binarios viven en
--    APPLICATION_DOCUMENT (bytea, máx 5 MB) — al conectar Supabase
--    Cloud se migran a Storage sin cambiar el modelo.
-- 2. Rate limiting del canje de códigos (5 intentos / 15 min por
--    correo) — antes era fuerza-brutable.
-- ============================================================

create type public.application_status as enum
  ('pending', 'in_review', 'needs_docs', 'approved', 'rejected');

create sequence public.application_folio_seq start 184;

create table public.broker_application (
  id             uuid primary key default gen_random_uuid(),
  folio          text not null unique
                 default ('APP-2026-' || lpad(nextval('public.application_folio_seq')::text, 5, '0')),
  developer_id   uuid not null references public.developer (id),
  full_name      text not null,
  email          text not null,
  phone          text,
  city           text,
  experience     text,                -- 0-2 | 3-5 | 5-10 | 10+
  specialty      text,
  brokerage_name text,                -- inmobiliaria (si tiene afiliación)
  motivation     text,
  status         public.application_status not null default 'pending',
  review_notes   text,
  decided_by     uuid references public.profile (id),
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_application_status on public.broker_application (status);
create trigger trg_application_updated_at before update on public.broker_application
  for each row execute function public.set_updated_at();
create trigger trg_audit_application after insert or update on public.broker_application
  for each row execute function public.write_audit_event();

create table public.application_document (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.broker_application (id) on delete cascade,
  doc_type       text not null,       -- ine | rfc | domicilio | bancaria | cedula
  filename       text not null,
  mime           text not null,
  size_bytes     int not null check (size_bytes between 1 and 5242880),
  content        bytea not null,      -- → Supabase Storage al ir a cloud
  created_at     timestamptz not null default now(),
  unique (application_id, doc_type)
);

alter table public.broker_application enable row level security;
alter table public.application_document enable row level security;

-- Solo admin lee; las inserciones llegan del portal vía service role.
create policy application_admin_select on public.broker_application
  for select to authenticated
  using (public.is_admin() and developer_id = public.current_developer_id());

create policy application_admin_update on public.broker_application
  for update to authenticated
  using (public.is_admin() and developer_id = public.current_developer_id())
  with check (public.is_admin() and developer_id = public.current_developer_id());

create policy app_doc_admin_select on public.application_document
  for select to authenticated
  using (public.is_admin() and exists (
    select 1 from public.broker_application a
    where a.id = application_id
      and a.developer_id = public.current_developer_id()
  ));

-- ---------- Rate limiting (hardening) ----------
create table public.portal_rate_limit (
  key          text primary key,      -- p. ej. 'redeem:correo@x.mx'
  window_start timestamptz not null default now(),
  attempts     int not null default 0
);
alter table public.portal_rate_limit enable row level security;

-- Incrementa y devuelve si el intento está permitido. NO lanza excepción:
-- un raise revertiría la transacción y el contador jamás persistiría
-- (los intentos fallidos quedarían sin registrar — inutilizando el límite).
create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.portal_rate_limit%rowtype;
begin
  insert into public.portal_rate_limit as rl (key, attempts)
  values (p_key, 1)
  on conflict (key) do update
    set attempts = case
          when rl.window_start < now() - p_window then 1
          else rl.attempts + 1
        end,
        window_start = case
          when rl.window_start < now() - p_window then now()
          else rl.window_start
        end
  returning * into v;

  return v.attempts <= p_max;
end;
$$;
revoke execute on function public.check_rate_limit from public, anon, authenticated;

-- Canje con rate limit: 5 intentos / 15 min por correo. Los errores se
-- RETORNAN como jsonb (no raise) para que el contador de intentos
-- fallidos sobreviva a la transacción.
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
  if not public.check_rate_limit('redeem:' || lower(trim(p_email)), 5, interval '15 minutes') then
    return jsonb_build_object('error', 'Demasiados intentos; espera 15 minutos e intenta de nuevo');
  end if;

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
    return jsonb_build_object('error', 'Código inválido, expirado o el correo no coincide');
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
