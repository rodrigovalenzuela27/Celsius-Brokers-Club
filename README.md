[README.md](https://github.com/user-attachments/files/28370393/README.md)
# Celsius · Plataforma · Prototipo

Prototipo navegable de la plataforma de cotización y gestión inmobiliaria de **Celsius**. Tres vistas funcionales sobre el mismo inventario y CRM: **Brokers** que cotizan y cierran, **Clientes** que compran sin intermediario o consultan cotizaciones recibidas, y **Administración** que configura políticas, comisiones y reportería.

> Estado: prototipo · v0.3 · datos representativos, no en vivo.

---

## Vistas

| Vista | Archivo | Para quién |
|---|---|---|
| **Cotizador & Pipeline** | `celsius-cotizador-prototipo.html` | Brokers internos y externos |
| **Portal público** | `celsius-portal-cliente.html` | Clientes finales |
| **Consola operativa** | `celsius-admin.html` | Administración Celsius |

Abrir `index.html` para la landing con accesos a las tres vistas.

---

## Estructura del repo

```
.
├── index.html                              · landing con accesos a las tres vistas
├── celsius-cotizador-prototipo.html        · vista broker · 16 secciones
├── celsius-portal-cliente.html             · vista cliente · sitio público
├── celsius-admin.html                      · vista admin · 17 secciones
├── celsius-cotizador-arquitectura.docx     · documento técnico
├── platform/                               · ⚡ la aplicación real (Next.js + Supabase)
└── README.md                               · este archivo
```

> **`platform/`** es la implementación productiva del prototipo (Fase 0 completada: schema con RLS, auth con roles, tokens de marca, CI). Ver [`platform/README.md`](platform/README.md).

---

## Qué contiene cada vista

### Broker · `celsius-cotizador-prototipo.html`

Dashboard, catálogo de proyectos, visualizador interactivo del edificio con disponibilidad en vivo, cotizador con generación de PDF y apartado 24h, clientes, **Mis comisiones** (ingresos, próximos pagos según política por proyecto, histórico), **Playbook de cierre** (workflow guiado de 7 etapas con scripts), **Expedientes** legales del cliente, promociones, Celsius Rewards (4 tiers), reserva de salas y showroom, sistema de guardias, eventos y webinars, academia de cursos (pagables con MXN o puntos), biblioteca de assets de marca, analytics.

### Cliente · `celsius-portal-cliente.html`

Landing pública con tres rutas: **compra directa** (sé tu propio broker, con bono +1%), acceso con código de cotización compartida por un broker, y solicitud para darse de alta como broker subiendo documentos. Catálogo público de proyectos, ficha técnica con visualizador del edificio, flujo completo de cotización + apartado 24h + pago de enganche con tarjeta vía Stripe, pantalla de reserva confirmada, agenda de visita al showroom, sección "Cómo funciona" con los 6 pasos del proceso.

### Admin · `celsius-admin.html`

Dashboard ejecutivo, inventario maestro (proyectos, unidades, tipologías, assets), clientes & deals consolidados, brokers (internos + externos), pagos & reservas con integración Stripe, **Políticas & montos** (configuración global del producto), **Configuración por proyecto** con overrides locales y política de pago de comisión por proyecto, esquema de comisiones (base + bonos por tier + simulador), configuración de Celsius Rewards, gestión de campañas (pop-ups, banners, emails), administración de salas y guardias, mapping de HubSpot, **Comisiones · pasivos & pagos** (aging del pasivo, payment runs, movimientos contables), solicitudes de broker, audit log, salud del sistema, reportes.

---

## Marca

Paleta extraída del sitio institucional [0celsius.mx](https://0celsius.mx/):

| Token | Hex | Uso |
|---|---|---|
| Canvas charcoal | `#383838` | Fondo principal |
| Deep dark | `#1E1E1E` | Sidebar, modales, hero |
| Texto primario | `#F5F5F5` | Texto principal |
| Cyan Celsius | `#009DEA` | Accent primario · CTAs · estados activos |
| Cyan hover | `#38A9FF` | Estados secundarios |
| Texto secundario | `#B5B5B5` | Metadata · captions |

Tipografía: **Inter Tight** (sans primaria), **JetBrains Mono** (metadata + section markers), **Source Serif 4** italic (acentos editoriales puntuales).

---

## Cómo verlo

### Localmente

Abrir `index.html` en cualquier navegador moderno. Cero dependencias — todo es HTML/CSS/JS estático sin build step.

### Desplegado en GitHub Pages

1. Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: **main** · Folder: **/ (root)**
4. URL pública: `https://<usuario>.github.io/<repo>/`

### Otras opciones

- **Netlify** · arrastrar la carpeta a [netlify.com/drop](https://app.netlify.com/drop)
- **Vercel** · `vercel deploy` desde la raíz del repo
- **Cloudflare Pages** · conectar repo y deploy automático (con Cloudflare Access gratis para password gate)

---

## Documentación técnica

`celsius-cotizador-arquitectura.docx` — documento de 17 secciones que cubre:

- Resumen ejecutivo y visión del producto
- Stack tecnológico recomendado (Next.js + Supabase + Stripe + HubSpot + Mifiel)
- Arquitectura del sistema en 4 capas
- Modelo de datos con 10 entidades principales
- Funcionalidades MVP con criterios de aceptación
- Flujos clave: cotización con apartado 24h, resolución del apartado, sync HubSpot bidireccional
- Visualizador del edificio (aproximación SVG)
- Biblioteca de assets de marca
- Integración HubSpot event-driven
- Generación de PDF y firma con Mifiel
- Seguridad y compliance (LFPDPPP, RLS, audit trail)
- Roadmap MVP en 6 fases mensuales
- Próximos pasos para Claude Code

---

## Confidencialidad

Este prototipo es **material interno de Celsius**. Los datos mostrados son representativos y no corresponden a clientes, brokers, transacciones o cifras reales. Para acceso institucional o consultas, escribir a `contacto@0celsius.mx`.

---

*v0.3 · 2026*
