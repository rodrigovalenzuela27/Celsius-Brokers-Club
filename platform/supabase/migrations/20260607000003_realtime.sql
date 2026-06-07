-- ============================================================
-- Celsius Platform · Fase 1 · Realtime
-- El visualizador del edificio se actualiza en vivo cuando otra
-- sesión aparta/vende una unidad (doc de arquitectura §09).
-- Los cambios respetan RLS: cada suscriptor solo recibe filas
-- de proyectos que puede ver.
-- ============================================================
alter publication supabase_realtime add table public.unit;
