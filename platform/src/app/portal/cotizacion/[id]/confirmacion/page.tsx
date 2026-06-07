import { redirect } from "next/navigation";
import { loadSharedQuote } from "@/lib/shared-quote";
import { formatMXN } from "@/lib/format";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await loadSharedQuote(id);
  if (!quote) redirect("/portal/codigo");
  if (!quote.paid) redirect(`/portal/cotizacion/${id}`);

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <div
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
        style={{ background: "var(--color-unit-available)" }}
      >
        ✓
      </div>
      <p className="section-mark mb-2">Reserva confirmada · {quote.folio}</p>
      <h1 className="mb-3 text-3xl font-normal tracking-tight">
        {quote.project.name} · Depto {quote.unit.unit_number} es tuyo
      </h1>
      <p className="mb-10 text-sm text-graphite">
        Recibimos tu enganche de {formatMXN(quote.down_payment_mxn)}. La unidad
        quedó reservada a nombre de {quote.client.full_name}.
      </p>

      <div className="border border-hairline bg-deep p-6 text-left">
        <p className="section-mark mb-4">Próximos pasos</p>
        <ol className="space-y-3 text-sm text-graphite">
          {[
            `Comprobante de pago a ${quote.client.email}`,
            "Factura electrónica con tu RFC (si lo proporcionaste)",
            "Borrador de la promesa de compraventa para tu revisión",
            "Llamada del equipo Celsius para coordinar la firma (60 días)",
          ].map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="font-mono text-xs text-accent">
                0{i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
