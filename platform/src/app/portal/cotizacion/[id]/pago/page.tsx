import { redirect } from "next/navigation";
import { loadSharedQuote } from "@/lib/shared-quote";
import { formatMXN } from "@/lib/format";
import { PaymentForm } from "./payment-form";

const r2 = (n: number) => Math.round(n * 100) / 100;

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await loadSharedQuote(id);
  if (!quote) redirect("/portal/codigo");
  if (quote.paid || quote.status !== "hold_active")
    redirect(`/portal/cotizacion/${id}`);

  const fee = r2(quote.down_payment_mxn * 0.015);
  const total = r2(quote.down_payment_mxn + fee);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="section-mark mb-2">§ Paso 5 · Pagar enganche</p>
      <h1 className="mb-8 text-2xl font-normal tracking-tight">
        {quote.project.name} · Depto {quote.unit.unit_number} ·{" "}
        {quote.folio}
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border border-hairline bg-deep p-5">
          <p className="section-mark mb-4">Detalle del cargo</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-hairline pb-1.5">
              <dt className="text-graphite">
                Enganche ({quote.down_payment_pct}%)
              </dt>
              <dd>{formatMXN(quote.down_payment_mxn)}</dd>
            </div>
            <div className="flex justify-between border-b border-hairline pb-1.5">
              <dt className="text-graphite">Comisión procesador (1.5%)</dt>
              <dd>{formatMXN(fee)}</dd>
            </div>
            <div className="flex justify-between pb-1.5 text-lg">
              <dt>Total a pagar</dt>
              <dd>{formatMXN(total)}</dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-hairline pt-4 text-xs text-graphite">
            El monto final lo calcula el servidor sobre el snapshot inmutable
            de tu cotización — no sobre lo que muestra esta página.
          </p>
        </div>

        <div className="border border-hairline bg-deep p-5">
          <p className="section-mark mb-4">Tarjeta de crédito o débito</p>
          <PaymentForm quoteId={quote.id} />
        </div>
      </div>
    </div>
  );
}
