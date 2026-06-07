<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Celsius Platform

Plataforma de cotización y gestión inmobiliaria de Celsius. Implementación productiva del prototipo navegable que vive en la raíz del repo (`../*.html`) siguiendo el documento de arquitectura `../celsius-cotizador-arquitectura.docx` (CELS-COT-2026.05).

## Stack

- **Next.js 16** (App Router, `src/`, alias `@/*`) · React 19 · TypeScript
- **Tailwind CSS 4** — tokens de marca ACORN/Celsius en `src/app/globals.css` (`@theme`). NO hardcodear colores hex en componentes; usar `bg-canvas`, `bg-deep`, `text-ink`, `text-graphite`, `border-hairline`, `text-accent`, etc.
- **Supabase** — Postgres + Auth + Storage. Migraciones en `supabase/migrations/`, seed en `supabase/seed.sql`.
- **Zod 4** para validación en server actions.
- En Next 16, `middleware.ts` se llama `proxy.ts` (ver `src/proxy.ts`).

## Reglas de arquitectura (del documento técnico)

1. **Postgres es la fuente de verdad** de inventario, dinero y contratos. HubSpot es CRM (fase 4).
2. **La autorización vive en RLS**, no en la UI. La UI puede ocultar; la DB decide. Roles: `admin`, `broker_internal`, `broker_external`, `client`. Brokers externos solo ven proyectos con convenio (`brokerage_project_access`).
3. **Cálculos financieros solo server-side** (server actions / route handlers). El cliente nunca calcula precios ni comisiones.
4. **`QUOTE` es inmutable después de `sent`** (trigger `enforce_quote_immutability`). Para cambiar condiciones se emite otra cotización.
5. **`UNIT_HOLD`**: solo un hold activo por unidad — índice único parcial `uq_unit_hold_active`. Nunca relajar.
6. **`AUDIT_EVENT` es append-only** — escrito por triggers; jamás se actualiza o borra.
7. **Idempotencia**: toda operación de sync externa lleva `client_token` único (`hubspot_sync_log`).

## Comandos

```bash
pnpm dev          # Next dev server
pnpm db:start     # Supabase local (Docker) — imprime URL y keys para .env.local
pnpm db:reset     # aplica migraciones + seed
pnpm db:user <email> <rol>  # crea usuario dev (requiere SUPABASE_SERVICE_ROLE_KEY)
pnpm lint && pnpm typecheck && pnpm build
```

## Roadmap (estado)

- [x] **Fase 0** — scaffold, schema 10 entidades + RLS, tokens de marca, auth con roles, CI
- [x] **Fase 1** — inventario y catálogo, visualizador SVG data-driven, realtime
- [x] **Fase 2** — quote engine atómico + clientes + PDF + apartado 24h con cron pg_cron
- [x] **Fase 3** — portal público (catálogo anon, compra directa +1%, acceso por código OTP, pago de enganche + reserva). Pagos detrás de adapter: MockProvider activo; StripeProvider pendiente de keys (`lib/payments.ts`)
- [x] **Fase 4** — motor de comisiones (devengo por hito de proyecto, reverso 90d, payment runs con ISR 10%) + cola de eventos HubSpot (`hubspot_sync_log`; el worker llega con credenciales)
- [ ] Fase 5 — onboarding brokers, audit UI, analytics, hardening
- [ ] Fase 6 — Rewards, campañas, academia, Mifiel, multi-tenant SaaS

## Convenciones

- Idioma de la UI y los comentarios de negocio: **español**. Código (identificadores): inglés.
- El prototipo HTML es la spec visual: ante duda de UX, abrir `../celsius-*.html`.
- Datos de seed son representativos, nunca reales (no RFCs/emails verdaderos).
