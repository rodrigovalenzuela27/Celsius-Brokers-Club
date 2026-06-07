-- ============================================================
-- Celsius Platform · Fase 0 · Row Level Security
--
-- Matriz de permisos:
--   admin            → todo dentro de su developer
--   broker_internal  → todos los proyectos de su developer;
--                      solo SUS clients/quotes/holds
--   broker_external  → solo proyectos con convenio de su brokerage;
--                      solo SUS clients/quotes/holds
--   client           → nada en fase 0 (portal llega en fase 3)
--   anon             → nada (el catálogo público se expone vía
--                      vistas/endpoints dedicados en fase 3)
-- ============================================================

-- ---------- Helpers (security definer para evitar recursión en policies) ----------
create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profile where id = auth.uid();
$$;

create or replace function public.current_developer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select developer_id from public.profile where id = auth.uid();
$$;

create or replace function public.current_brokerage_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select brokerage_id from public.profile where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'admin';
$$;

create or replace function public.is_broker()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('broker_internal', 'broker_external');
$$;

-- ¿El usuario actual puede ver este proyecto?
create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project p
    where p.id = p_project_id
      and p.developer_id = public.current_developer_id()
      and (
        public.current_profile_role() in ('admin', 'broker_internal')
        or exists (
          select 1 from public.brokerage_project_access bpa
          where bpa.project_id = p.id
            and bpa.brokerage_id = public.current_brokerage_id()
        )
      )
  );
$$;

-- ---------- Activar RLS en todas las tablas ----------
alter table public.developer enable row level security;
alter table public.brokerage enable row level security;
alter table public.profile enable row level security;
alter table public.project enable row level security;
alter table public.brokerage_project_access enable row level security;
alter table public.unit enable row level security;
alter table public.asset enable row level security;
alter table public.client enable row level security;
alter table public.quote enable row level security;
alter table public.unit_hold enable row level security;
alter table public.audit_event enable row level security;
alter table public.hubspot_sync_log enable row level security;

-- ---------- DEVELOPER ----------
create policy developer_select on public.developer
  for select to authenticated
  using (id = public.current_developer_id());

create policy developer_admin_write on public.developer
  for update to authenticated
  using (id = public.current_developer_id() and public.is_admin());

-- ---------- BROKERAGE ----------
create policy brokerage_select on public.brokerage
  for select to authenticated
  using (developer_id = public.current_developer_id());

create policy brokerage_admin_all on public.brokerage
  for all to authenticated
  using (developer_id = public.current_developer_id() and public.is_admin())
  with check (developer_id = public.current_developer_id() and public.is_admin());

-- ---------- PROFILE ----------
-- Cada quien ve su propio perfil; admin ve todos los de su developer.
create policy profile_select_own on public.profile
  for select to authenticated
  using (id = auth.uid() or (public.is_admin() and developer_id = public.current_developer_id()));

-- Self-update solo de datos de contacto (el rol NO: columnas protegidas vía
-- trigger abajo). Admin actualiza cualquier perfil de su developer.
create policy profile_update_own on public.profile
  for update to authenticated
  using (id = auth.uid() or (public.is_admin() and developer_id = public.current_developer_id()))
  with check (id = auth.uid() or (public.is_admin() and developer_id = public.current_developer_id()));

create policy profile_admin_insert on public.profile
  for insert to authenticated
  with check (public.is_admin() and developer_id = public.current_developer_id());

-- Un no-admin no puede escalar su propio rol/brokerage/active.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() null = contexto de sistema (service role / triggers de auth):
  -- pasa. Un usuario autenticado no-admin no puede escalar privilegios.
  if auth.uid() is not null and not public.is_admin() and (
    new.role is distinct from old.role
    or new.brokerage_id is distinct from old.brokerage_id
    or new.active is distinct from old.active
    or new.developer_id is distinct from old.developer_id
  ) then
    raise exception 'Solo un admin puede cambiar rol, inmobiliaria o estado de un perfil';
  end if;
  return new;
end;
$$;
create trigger trg_profile_no_escalation before update on public.profile
  for each row execute function public.prevent_profile_privilege_escalation();

-- ---------- PROJECT ----------
create policy project_select on public.project
  for select to authenticated
  using (public.can_access_project(id));

create policy project_admin_write on public.project
  for all to authenticated
  using (developer_id = public.current_developer_id() and public.is_admin())
  with check (developer_id = public.current_developer_id() and public.is_admin());

-- ---------- BROKERAGE_PROJECT_ACCESS ----------
create policy bpa_select on public.brokerage_project_access
  for select to authenticated
  using (
    public.is_admin()
    or brokerage_id = public.current_brokerage_id()
  );

create policy bpa_admin_write on public.brokerage_project_access
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- UNIT ----------
create policy unit_select on public.unit
  for select to authenticated
  using (public.can_access_project(project_id));

create policy unit_admin_write on public.unit
  for all to authenticated
  using (public.is_admin() and public.can_access_project(project_id))
  with check (public.is_admin() and public.can_access_project(project_id));

-- ---------- ASSET ----------
-- Brokers ven assets de proyectos accesibles + assets generales del developer.
-- Solo admin sube/edita (gobierno de la biblioteca).
create policy asset_select on public.asset
  for select to authenticated
  using (
    developer_id = public.current_developer_id()
    and (project_id is null or public.can_access_project(project_id))
  );

create policy asset_admin_write on public.asset
  for all to authenticated
  using (developer_id = public.current_developer_id() and public.is_admin())
  with check (developer_id = public.current_developer_id() and public.is_admin());

-- ---------- CLIENT ----------
-- Broker ve y gestiona SOLO sus clientes; admin todos los de su developer.
create policy client_select on public.client
  for select to authenticated
  using (
    developer_id = public.current_developer_id()
    and (broker_id = auth.uid() or public.is_admin())
  );

create policy client_insert on public.client
  for insert to authenticated
  with check (
    developer_id = public.current_developer_id()
    and (broker_id = auth.uid() or public.is_admin())
    and (public.is_broker() or public.is_admin())
  );

create policy client_update on public.client
  for update to authenticated
  using (
    developer_id = public.current_developer_id()
    and (broker_id = auth.uid() or public.is_admin())
  )
  with check (
    developer_id = public.current_developer_id()
    and (broker_id = auth.uid() or public.is_admin())
  );

-- ---------- QUOTE ----------
create policy quote_select on public.quote
  for select to authenticated
  using (
    developer_id = public.current_developer_id()
    and (broker_id = auth.uid() or public.is_admin())
  );

create policy quote_insert on public.quote
  for insert to authenticated
  with check (
    developer_id = public.current_developer_id()
    and broker_id = auth.uid()
    and public.is_broker()
    and public.can_access_project((select project_id from public.unit where id = unit_id))
  );

create policy quote_update on public.quote
  for update to authenticated
  using (
    developer_id = public.current_developer_id()
    and (broker_id = auth.uid() or public.is_admin())
  )
  with check (
    developer_id = public.current_developer_id()
    and (broker_id = auth.uid() or public.is_admin())
  );

-- Sin DELETE: las cotizaciones se cancelan (status), nunca se borran.

-- ---------- UNIT_HOLD ----------
-- Los brokers ven todos los holds de proyectos accesibles (el visualizador
-- necesita saber qué está apartado), pero solo crean los suyos.
create policy unit_hold_select on public.unit_hold
  for select to authenticated
  using (public.can_access_project((select project_id from public.unit where id = unit_id)));

create policy unit_hold_insert on public.unit_hold
  for insert to authenticated
  with check (
    broker_id = auth.uid()
    and public.is_broker()
    and public.can_access_project((select project_id from public.unit where id = unit_id))
  );

create policy unit_hold_update on public.unit_hold
  for update to authenticated
  using (broker_id = auth.uid() or public.is_admin())
  with check (broker_id = auth.uid() or public.is_admin());

-- ---------- AUDIT_EVENT ----------
-- Solo lectura para admin. Los INSERT ocurren vía trigger security definer.
create policy audit_admin_select on public.audit_event
  for select to authenticated
  using (public.is_admin() and developer_id = public.current_developer_id());

-- ---------- HUBSPOT_SYNC_LOG ----------
-- Solo admin consulta; el worker escribe con service role (bypassa RLS).
create policy sync_admin_select on public.hubspot_sync_log
  for select to authenticated
  using (public.is_admin() and developer_id = public.current_developer_id());
