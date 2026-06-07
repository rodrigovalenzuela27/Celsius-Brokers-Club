# Celsius Brokers Club

Dos cosas viven en este repo:

1. **`/*.html` (raíz)** — Prototipo navegable v0.3 (spec visual, 36 pantallas, datos mock). **No tocar salvo pedido explícito**; se despliega tal cual en GitHub Pages y es la referencia de UX.
2. **`platform/`** — La aplicación real (Next.js 16 + Supabase). Todo el desarrollo ocurre aquí. Leer `platform/AGENTS.md` para stack, reglas de arquitectura y estado del roadmap.

Documento de arquitectura: `celsius-cotizador-arquitectura.docx` (17 secciones: modelo de datos, flujos, integraciones HubSpot/Stripe/Mifiel, roadmap 6 fases).

Regla de oro del proyecto: todo lo que toca **inventario y dinero** se valida en Postgres (constraints + RLS + triggers), nunca solo en la UI.
