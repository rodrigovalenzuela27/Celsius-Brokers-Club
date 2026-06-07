# Celsius Platform

Aplicación productiva de la plataforma Celsius (cotizador inmobiliario, portal cliente y consola admin). Implementa el prototipo navegable de la raíz del repo siguiendo `../celsius-cotizador-arquitectura.docx`.

**Estado: Fase 0 completada** — scaffold, schema con RLS, tokens de marca, auth con roles, CI.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + Storage) · Zod

## Desarrollo local

Requisitos: Node 24+, pnpm, Docker (para Supabase local).

```bash
pnpm install
pnpm db:start            # levanta Supabase local; imprime API URL, anon key y service_role key
cp .env.example .env.local   # pega las keys que imprimió db:start
pnpm db:reset            # aplica migraciones + seed (3 proyectos, 264 unidades, 3 inmobiliarias)

# usuarios de prueba (necesita SUPABASE_SERVICE_ROLE_KEY exportada o en el entorno)
pnpm db:user admin@celsius.test admin
pnpm db:user broker@celsius.test broker_internal

pnpm dev                 # http://localhost:3000
```

Rutas: `/login` → según rol redirige a `/admin` (consola) o `/broker` (cotizador). El portal cliente público llega en fase 3.

## Estructura

```
supabase/
  migrations/
    ..._schema.sql   # 10 entidades + triggers (inmutabilidad de QUOTE, audit append-only, hold único)
    ..._rls.sql      # Row Level Security: matriz admin / broker interno / broker externo
  seed.sql           # datos representativos del prototipo
src/
  proxy.ts           # refresh de sesión + gate de rutas protegidas (Next 16: antes middleware)
  lib/supabase/      # clientes browser/server (@supabase/ssr)
  lib/auth.ts        # requireProfile() · autorización por rol en layouts
  app/login/         # login con server action + Zod
  app/admin/         # consola (rol admin)
  app/broker/        # cotizador (roles broker_*)
```

## Verificación

```bash
pnpm lint && pnpm typecheck && pnpm build
```

CI en `.github/workflows/ci.yml` corre lo mismo en cada PR que toque `platform/`.
