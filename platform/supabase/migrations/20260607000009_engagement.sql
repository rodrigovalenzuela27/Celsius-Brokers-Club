-- ============================================================
-- Celsius Platform · Fase 7 · Salas, Guardias, Eventos, Academia
--
-- · ROOM_BOOKING: anti-doble-reserva con EXCLUSION CONSTRAINT
--   (dos reservas no pueden solaparse en la misma sala — lo
--   garantiza Postgres, no la UI). Reglas del prototipo: máx 3
--   activas por broker, cancelar hasta 4h antes.
-- · DUTY_SLOT: guardias de showroom reclamables (+30 pts).
-- · EVENT: webinars/eventos con registro y puntos por asistencia.
-- · COURSE: academia; cursos pagables con puntos Rewards,
--   +puntos al completar.
-- Todas las funciones retornan errores como jsonb (patrón fase 5).
-- ============================================================

create extension if not exists btree_gist;

-- ---------- Salas ----------
create table public.room (
  id           uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer (id),
  showroom     text not null,            -- Solar Polanco, Atrio Condesa…
  name         text not null,
  capacity     int not null default 4,
  equipment    text,
  bookable     boolean not null default true,
  unique (developer_id, showroom, name)
);
alter table public.room enable row level security;
create policy room_select on public.room
  for select to authenticated using (developer_id = public.current_developer_id());
create policy room_admin_write on public.room
  for all to authenticated
  using (developer_id = public.current_developer_id() and public.is_admin())
  with check (developer_id = public.current_developer_id() and public.is_admin());

create table public.room_booking (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.room (id),
  broker_id    uuid not null references public.profile (id),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  purpose      text,
  client_name  text,
  cancelled_at timestamptz,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Postgres impide el solape de reservas vigentes en la misma sala.
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (cancelled_at is null)
);
create index idx_booking_broker on public.room_booking (broker_id);
alter table public.room_booking enable row level security;
-- Todos los brokers ven la agenda (para saber qué está ocupado).
create policy booking_select on public.room_booking
  for select to authenticated
  using (exists (
    select 1 from public.room r
    where r.id = room_id and r.developer_id = public.current_developer_id()
  ));

create or replace function public.book_room(
  p_room_id uuid,
  p_starts_at timestamptz,
  p_minutes int,
  p_purpose text default null,
  p_client_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active int;
begin
  if not public.is_broker() then
    return jsonb_build_object('error', 'Solo brokers pueden reservar salas');
  end if;
  if p_minutes not in (30, 60, 90) then
    return jsonb_build_object('error', 'Duración válida: 30, 60 o 90 minutos');
  end if;
  if p_starts_at < now() then
    return jsonb_build_object('error', 'La reserva debe ser a futuro');
  end if;
  if not exists (select 1 from public.room where id = p_room_id and bookable) then
    return jsonb_build_object('error', 'Sala no disponible');
  end if;

  select count(*) into v_active from public.room_booking
    where broker_id = auth.uid() and cancelled_at is null and ends_at > now();
  if v_active >= 3 then
    return jsonb_build_object('error', 'Máximo 3 reservas activas; cancela una primero');
  end if;

  begin
    insert into public.room_booking (room_id, broker_id, starts_at, ends_at, purpose, client_name)
    values (p_room_id, auth.uid(), p_starts_at, p_starts_at + make_interval(mins => p_minutes), p_purpose, p_client_name);
  exception when exclusion_violation then
    return jsonb_build_object('error', 'Ese horario ya está ocupado en esa sala');
  end;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.room_booking%rowtype;
begin
  select * into v from public.room_booking where id = p_booking_id for update;
  if not found or v.cancelled_at is not null then
    return jsonb_build_object('error', 'Reserva no encontrada');
  end if;
  if v.broker_id <> auth.uid() and not public.is_admin() then
    return jsonb_build_object('error', 'No es tu reserva');
  end if;
  if v.starts_at < now() + interval '4 hours' and not public.is_admin() then
    return jsonb_build_object('error', 'Solo puedes cancelar hasta 4 horas antes');
  end if;
  update public.room_booking set cancelled_at = now() where id = p_booking_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- Guardias ----------
create table public.duty_slot (
  id           uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer (id),
  showroom     text not null,
  duty_date    date not null,
  shift        text not null check (shift in ('matutino', 'vespertino')),
  broker_id    uuid references public.profile (id),  -- null = libre
  unique (developer_id, showroom, duty_date, shift)
);
alter table public.duty_slot enable row level security;
create policy duty_select on public.duty_slot
  for select to authenticated using (developer_id = public.current_developer_id());
create policy duty_admin_write on public.duty_slot
  for all to authenticated
  using (developer_id = public.current_developer_id() and public.is_admin())
  with check (developer_id = public.current_developer_id() and public.is_admin());

create or replace function public.claim_duty(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.duty_slot%rowtype;
begin
  if not public.is_broker() then
    return jsonb_build_object('error', 'Solo brokers pueden tomar guardias');
  end if;
  select * into v from public.duty_slot where id = p_slot_id for update;
  if not found then return jsonb_build_object('error', 'Guardia no encontrada'); end if;
  if v.broker_id is not null then
    return jsonb_build_object('error', 'Esa guardia ya está tomada');
  end if;
  if v.duty_date < current_date then
    return jsonb_build_object('error', 'La guardia ya pasó');
  end if;

  update public.duty_slot set broker_id = auth.uid() where id = p_slot_id;
  insert into public.reward_event (developer_id, broker_id, points, concept, entity, entity_id)
  values (v.developer_id, auth.uid(), 30,
          format('Guardia %s · %s %s', v.showroom, v.duty_date, v.shift), 'duty_slot', v.id);
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- Eventos & webinars ----------
create table public.event (
  id           uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer (id),
  title        text not null,
  kind         text not null check (kind in ('webinar', 'showroom', 'networking', 'lanzamiento')),
  starts_at    timestamptz not null,
  location     text,
  capacity     int,
  points       int not null default 20,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.event enable row level security;
create policy event_select on public.event
  for select to authenticated using (developer_id = public.current_developer_id());
create policy event_admin_write on public.event
  for all to authenticated
  using (developer_id = public.current_developer_id() and public.is_admin())
  with check (developer_id = public.current_developer_id() and public.is_admin());

create table public.event_registration (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.event (id),
  broker_id  uuid not null references public.profile (id),
  attended   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, broker_id)
);
alter table public.event_registration enable row level security;
create policy event_reg_select on public.event_registration
  for select to authenticated
  using (broker_id = auth.uid() or public.is_admin());

create or replace function public.register_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.event%rowtype;
  v_count int;
begin
  if not public.is_broker() then
    return jsonb_build_object('error', 'Solo brokers pueden registrarse');
  end if;
  select * into v from public.event where id = p_event_id and active for update;
  if not found then return jsonb_build_object('error', 'Evento no disponible'); end if;
  if v.starts_at < now() then
    return jsonb_build_object('error', 'El evento ya ocurrió');
  end if;
  if v.capacity is not null then
    select count(*) into v_count from public.event_registration where event_id = v.id;
    if v_count >= v.capacity then
      return jsonb_build_object('error', 'Cupo lleno');
    end if;
  end if;
  insert into public.event_registration (event_id, broker_id)
  values (v.id, auth.uid())
  on conflict (event_id, broker_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

-- Admin marca asistencia → se acreditan los puntos del evento.
create or replace function public.mark_event_attendance(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.event_registration%rowtype;
  v_event public.event%rowtype;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'Solo administración');
  end if;
  select * into v_reg from public.event_registration where id = p_registration_id for update;
  if not found or v_reg.attended then
    return jsonb_build_object('error', 'Registro no encontrado o ya acreditado');
  end if;
  select * into v_event from public.event where id = v_reg.event_id;

  update public.event_registration set attended = true where id = v_reg.id;
  insert into public.reward_event (developer_id, broker_id, points, concept, entity, entity_id)
  values (v_event.developer_id, v_reg.broker_id, v_event.points,
          'Asistencia · ' || v_event.title, 'event', v_event.id);
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- Academia ----------
-- Los canjes genéricos (cursos) no requieren un reward_item.
alter table public.reward_redemption alter column item_id drop not null;
alter table public.reward_redemption add column concept text;

create table public.course (
  id            uuid primary key default gen_random_uuid(),
  developer_id  uuid not null references public.developer (id),
  title         text not null,
  category      text not null,            -- Ventas, Hipotecario, Producto…
  description   text,
  duration_min  int not null default 60,
  points_cost   int not null default 0,   -- 0 = gratuito
  points_reward int not null default 50,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.course enable row level security;
create policy course_select on public.course
  for select to authenticated using (developer_id = public.current_developer_id());
create policy course_admin_write on public.course
  for all to authenticated
  using (developer_id = public.current_developer_id() and public.is_admin())
  with check (developer_id = public.current_developer_id() and public.is_admin());

create table public.course_enrollment (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.course (id),
  broker_id    uuid not null references public.profile (id),
  status       text not null default 'enrolled' check (status in ('enrolled', 'completed')),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (course_id, broker_id)
);
alter table public.course_enrollment enable row level security;
create policy enrollment_select on public.course_enrollment
  for select to authenticated
  using (broker_id = auth.uid() or public.is_admin());

create or replace function public.enroll_course(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.course%rowtype;
  v_balance int;
begin
  if not public.is_broker() then
    return jsonb_build_object('error', 'Solo brokers pueden inscribirse');
  end if;
  select * into v from public.course where id = p_course_id and active;
  if not found then return jsonb_build_object('error', 'Curso no disponible'); end if;
  if exists (select 1 from public.course_enrollment where course_id = v.id and broker_id = auth.uid()) then
    return jsonb_build_object('error', 'Ya estás inscrito');
  end if;

  if v.points_cost > 0 then
    v_balance := public.reward_balance(auth.uid());
    if v_balance < v.points_cost then
      return jsonb_build_object('error',
        format('Saldo insuficiente: tienes %s pts y cuesta %s', v_balance, v.points_cost));
    end if;
    insert into public.reward_redemption (developer_id, broker_id, item_id, points_spent, concept, status)
    values (v.developer_id, auth.uid(), null, v.points_cost, 'Curso · ' || v.title, 'delivered');
  end if;

  insert into public.course_enrollment (course_id, broker_id) values (v.id, auth.uid());
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.complete_course(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enr public.course_enrollment%rowtype;
  v public.course%rowtype;
begin
  select * into v_enr from public.course_enrollment
    where course_id = p_course_id and broker_id = auth.uid() for update;
  if not found then return jsonb_build_object('error', 'No estás inscrito'); end if;
  if v_enr.status = 'completed' then
    return jsonb_build_object('error', 'Ya completaste este curso');
  end if;
  select * into v from public.course where id = p_course_id;

  update public.course_enrollment
    set status = 'completed', completed_at = now() where id = v_enr.id;
  insert into public.reward_event (developer_id, broker_id, points, concept, entity, entity_id)
  values (v.developer_id, auth.uid(), v.points_reward,
          'Curso completado · ' || v.title, 'course', v.id);
  return jsonb_build_object('ok', true, 'points', v.points_reward);
end;
$$;

grant execute on function public.book_room to authenticated;
grant execute on function public.cancel_booking to authenticated;
grant execute on function public.claim_duty to authenticated;
grant execute on function public.register_event to authenticated;
grant execute on function public.mark_event_attendance to authenticated;
grant execute on function public.enroll_course to authenticated;
grant execute on function public.complete_course to authenticated;
