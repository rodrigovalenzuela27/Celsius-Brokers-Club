# Celsius Platform

Aplicación productiva de la plataforma Celsius (cotizador inmobiliario, portal cliente y consola admin). Implementa el prototipo navegable de la raíz del repo siguiendo `../celsius-cotizador-arquitectura.docx`.

**Estado: Fases 0–6 completadas** — ver roadmap detallado en [`AGENTS.md`](AGENTS.md).

| Área | Qué incluye |
|---|---|
| **Broker** `/broker` | Catálogo con RLS por convenio · visualizador SVG con realtime · cotizador con apartado 24h atómico · PDF · clientes (LFPDPPP) · comisiones con tier bonus · Rewards |
| **Admin** `/admin` | Inventario CRUD · comisiones (aging, payment runs con ISR) · solicitudes de broker · campañas · analytics · audit log |
| **Portal** `/portal` | Catálogo público · compra directa +1% · acceso por código OTP · pago de enganche (mock → Stripe) · alta de brokers con docs |

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres + Auth) · Zod · React-PDF

## Desarrollo local

Requisitos: Node 24+, pnpm, Docker (para Supabase local).

```bash
pnpm install
pnpm db:start            # levanta Supabase local; imprime API URL y keys
cp .env.example .env.local   # pega las keys que imprimió db:start
pnpm db:reset            # aplica las 8 migraciones + seed

# usuarios de prueba (password celsius-dev-123)
pnpm db:user admin@celsius.test admin
pnpm db:user broker@celsius.test broker_internal
pnpm db:user externo@remax.test broker_external <uuid-brokerage>

pnpm dev                 # http://localhost:3000
```

Tarjeta de prueba del portal: `4242 4242 4242 4242`, vencimiento futuro, CVC `123`.

## Estructura

```
supabase/migrations/     # 8 migraciones: schema+RLS, realtime, quote engine,
                         # portal+pagos, comisiones, solicitudes, rewards+campañas
supabase/seed.sql        # 3 proyectos, 264 unidades, tiers y catálogo Rewards
src/proxy.ts             # sesión + gate de rutas (Next 16: antes middleware)
src/lib/                 # supabase clients · auth por rol · quote-engine ·
                         # payments adapter · portal-session
src/app/{broker,admin,portal,login}/
```

## Invariantes (viven en la DB, no en la UI)

- Un solo hold activo por unidad (`uq_unit_hold_active`)
- `QUOTE` inmutable tras emisión (trigger)
- `AUDIT_EVENT` append-only · toda mutación sensible auditada
- Montos de pago recalculados por la DB del snapshot (nunca del cliente)
- Comisiones: devengo por hito de proyecto · reverso en ventana de 90d
- Rate limiting en canje de códigos (5 / 15 min por correo)

## Pendientes de credenciales externas

StripeProvider (`src/lib/payments.ts`) · worker HubSpot (`hubspot_sync_log`) · Resend · Mifiel · deploy Supabase Cloud + Vercel.

## Verificación

```bash
pnpm lint && pnpm typecheck && pnpm build
```

CI en `.github/workflows/ci.yml` corre lo mismo en cada PR que toque `platform/`.
