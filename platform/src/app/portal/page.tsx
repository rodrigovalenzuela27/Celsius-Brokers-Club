import Link from "next/link";

export const metadata = { title: "Celsius · Compra directa" };

export default function PortalLanding() {
  return (
    <div className="mx-auto max-w-5xl px-6">
      <section className="py-20">
        <p className="section-mark mb-5 !text-accent">
          § Compra directa · sin intermediarios
        </p>
        <h1 className="max-w-2xl text-5xl font-normal leading-tight tracking-tight">
          Tu siguiente departamento,{" "}
          <span className="text-accent">sin broker y con mejor precio.</span>
        </h1>
        <p className="mt-6 max-w-xl text-graphite">
          Explora el inventario en vivo, cotiza en línea y aparta tu unidad por
          24 horas. Si compras directo, el bono del 1% es tuyo.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 pb-20 sm:grid-cols-3">
        <Link
          href="/portal/proyectos"
          className="group border border-hairline bg-deep p-6 transition-colors hover:border-accent"
        >
          <p className="section-mark mb-3 !text-accent">Ruta A</p>
          <h2 className="mb-2 text-xl">Compra directa</h2>
          <p className="text-sm text-graphite">
            Sé tu propio broker: explora, cotiza y aparta con bono adicional
            del 1% sobre el precio de lista.
          </p>
          <p className="mt-4 text-xs uppercase tracking-wider text-accent">
            Explorar departamentos{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </p>
        </Link>

        <Link
          href="/portal/codigo"
          className="group border border-hairline bg-deep p-6 transition-colors hover:border-accent"
        >
          <p className="section-mark mb-3 !text-accent">Ruta B</p>
          <h2 className="mb-2 text-xl">Tengo un código</h2>
          <p className="text-sm text-graphite">
            ¿Un broker te compartió una cotización? Entra con tu correo y el
            código de 6 dígitos para verla y pagar tu enganche.
          </p>
          <p className="mt-4 text-xs uppercase tracking-wider text-accent">
            Acceder a mi cotización{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </p>
        </Link>

        <Link
          href="/portal/broker"
          className="group border border-hairline bg-deep p-6 transition-colors hover:border-accent"
        >
          <p className="section-mark mb-3 !text-accent">Ruta C</p>
          <h2 className="mb-2 text-xl">Quiero ser broker</h2>
          <p className="text-sm text-graphite">
            Vende inventario Celsius: comisión base 2.5% + bonos. Sube tu
            documentación y recibe respuesta en 3 días hábiles.
          </p>
          <p className="mt-4 text-xs uppercase tracking-wider text-accent">
            Enviar solicitud{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </p>
        </Link>
      </section>
    </div>
  );
}
