-- ============================================================
-- Celsius Platform · Seed de desarrollo
-- Datos representativos tomados del prototipo (NO reales).
-- Se ejecuta con `supabase db reset` en local.
-- ============================================================

-- ---------- Developer ----------
insert into public.developer (id, name, slug, brand_tokens)
values (
  '00000000-0000-0000-0000-000000000001',
  'Celsius',
  'celsius',
  '{
    "canvas": "#383838",
    "deep": "#1E1E1E",
    "ink": "#F5F5F5",
    "graphite": "#B5B5B5",
    "accent": "#009DEA",
    "accentHover": "#38A9FF"
  }'::jsonb
);

-- ---------- Brokerages externas (convenios) ----------
insert into public.brokerage (id, developer_id, name) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 'Sotheby''s International Realty'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000001', 'Coldwell Banker'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000001', 'RE/MAX México');

-- ---------- Proyectos ----------
-- policy_overrides: bono pre-venta y duración del apartado por proyecto
-- (mismos valores que el prototipo: Solar 3%, Atrio 4%, Cima 7%).
insert into public.project (id, developer_id, code, name, location, status, delivery_date, levels, tech_specs, policy_overrides) values
  (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-000000000001',
    'SOL-2026', 'Solar', 'Polanco, CDMX', 'selling', '2027-12-01', 14,
    '{"towers": 1, "units_per_floor": 6, "amenities": ["gym", "rooftop", "coworking", "sky bar"], "certification": "LEED Gold"}'::jsonb,
    '{"presale_bonus_pct": 3, "direct_purchase_bonus_pct": 1, "hold_hours": 24}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-000000000001',
    'ATR-2026', 'Atrio', 'Condesa, CDMX', 'selling', '2027-06-01', 7,
    '{"towers": 2, "units_per_floor": 6, "amenities": ["patio central", "gym", "pet spa"]}'::jsonb,
    '{"presale_bonus_pct": 4, "direct_purchase_bonus_pct": 1, "hold_hours": 24}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-000000000001',
    'CIM-2026', 'Cima', 'Coyoacán, CDMX', 'presale', '2029-03-01', 16,
    '{"towers": 1, "units_per_floor": 6, "amenities": ["alberca", "salón de usos múltiples", "huerto urbano"]}'::jsonb,
    '{"presale_bonus_pct": 7, "direct_purchase_bonus_pct": 1, "hold_hours": 24}'::jsonb
  );

-- ---------- Unidades ----------
-- Genera unidades por proyecto: piso × posición, con precio en función de
-- m² y altura (mismo modelo que el prototipo: m2 * tarifa + piso * prima).
-- Solar: 14 pisos × 6 = 84 unidades · Atrio: 7 × 12 = 84 · Cima: 16 × 6 = 96.
with cfg as (
  select * from (values
    ('00000000-0000-0000-0000-0000000000a1'::uuid, 14, 6, 91500.0, 80000.0),
    ('00000000-0000-0000-0000-0000000000a2'::uuid,  7, 12, 78000.0, 65000.0),
    ('00000000-0000-0000-0000-0000000000a3'::uuid, 16, 6, 64000.0, 55000.0)
  ) as t(project_id, floors, per_floor, rate_m2, floor_premium)
),
gen as (
  select
    c.project_id,
    f.floor,
    p.pos,
    lpad(f.floor::text, 2, '0') || lpad(p.pos::text, 2, '0') as unit_number,
    -- m² determinista por posición (entre 58 y 142 m²)
    58 + ((f.floor * 7 + p.pos * 13) % 85) as m2
  from cfg c
  cross join lateral generate_series(1, c.floors) as f(floor)
  cross join lateral generate_series(1, c.per_floor) as p(pos)
)
insert into public.unit
  (project_id, unit_number, floor, m2, bedrooms, bathrooms, parking_spots, has_storage, orientation, list_price_mxn, status, svg_coords)
select
  g.project_id,
  g.unit_number,
  g.floor,
  g.m2,
  case when g.m2 < 75 then 1 when g.m2 < 110 then 2 else 3 end,
  case when g.m2 < 75 then 1.0 when g.m2 < 110 then 2.0 else 2.5 end,
  case when g.m2 < 75 then 1 else 2 end,
  g.m2 >= 90,
  (array['Norte', 'Sur', 'Oriente', 'Poniente'])[1 + (g.pos % 4)],
  round((g.m2 * c.rate_m2 + g.floor * c.floor_premium)::numeric, 2),
  -- distribución determinista de estados parecida al prototipo
  case (g.floor * 11 + g.pos * 3) % 10
    when 0 then 'sold'::public.unit_status
    when 1 then 'sold'::public.unit_status
    when 2 then 'reserved'::public.unit_status
    else 'available'::public.unit_status
  end,
  jsonb_build_object('floor', g.floor, 'pos', g.pos)
from gen g
join cfg c using (project_id);

-- ---------- Convenios brokerage ↔ proyecto ----------
-- Sotheby's y Coldwell venden Solar y Atrio; RE/MAX solo Cima.
insert into public.brokerage_project_access (brokerage_id, project_id, commission_pct) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 2.50),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2', 2.50),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 2.50),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 2.50),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a3', 2.50);

-- ---------- Celsius Rewards · tiers y catálogo ----------
insert into public.reward_tier (developer_id, slug, name, min_points, commission_bonus_pct, sort) values
  ('00000000-0000-0000-0000-000000000001', 'bellota', 'Bellota', 0, 0, 1),
  ('00000000-0000-0000-0000-000000000001', 'roble-joven', 'Roble Joven', 1000, 0.5, 2),
  ('00000000-0000-0000-0000-000000000001', 'roble', 'Roble', 3000, 1.5, 3),
  ('00000000-0000-0000-0000-000000000001', 'roble-maestro', 'Roble Maestro', 8000, 3, 4);

insert into public.reward_item (developer_id, title, description, points_cost, stock, min_tier_slug) values
  ('00000000-0000-0000-0000-000000000001', 'Curso · Cierre avanzado', 'Acceso al curso premium de la academia', 300, null, null),
  ('00000000-0000-0000-0000-000000000001', 'Cena para 2 · evento VIP', 'Cena con el equipo directivo en lanzamiento', 800, 12, null),
  ('00000000-0000-0000-0000-000000000001', 'iPad Air', 'Para tus presentaciones en showroom', 2400, 3, 'roble-joven'),
  ('00000000-0000-0000-0000-000000000001', 'Mentoría 1:1 con dirección comercial', 'Sesión mensual por un trimestre', 1500, 5, 'roble');

-- ---------- Usuarios de prueba ----------
-- Los usuarios se crean vía Supabase Auth (no por seed SQL directo a auth.users
-- en producción). Para desarrollo local, crear con:
--
--   admin:  pnpm db:user admin@celsius.test admin
--   broker: pnpm db:user broker@celsius.test broker_internal
--
-- (ver scripts/create-user.mjs)
