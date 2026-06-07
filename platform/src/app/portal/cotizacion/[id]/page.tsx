import Link from "next/link";
import { redirect } from "next/navigation";
import { HoldCountdown } from "@/components/hold-countdown";
import { loadSharedQuote } from "@/lib/shared-quote";
import { formatMXN } from "@/lib/format";

export default async function ClientQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await loadSharedQuote(id);
  if (!quote) redirect("/portal/codigo");

  const holdActive =
    quote.status === "hold_active" &&
    quote.hold_expires_at &&
    new Date(quote.hold_expires_at) > new Date();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="section-mark mb-2">
        Cotización · {quote.folio}
        {quote.channel === "direct" ? " · compra directa" : " · de tu broker"}
      </p>
      <h1 className="text-2xl font-normal tracking-tight">
        {quote.project.name} · Depto {quote.unit.unit_number}
      </h1>
      <p className="mb-6 text-sm text-graphite">
        Hola {quote.client.full_name.split(" ")[0]} — {quote.unit.m2} m² ·{" "}
        {quote.unit.bedrooms} rec · {quote.unit.bathrooms} baños · piso{" "}
        {quote.unit.floor}
      </p>

      {quote.paid || quote.status === "reserved" ? (
        <div className="mb-6 border border-unit-available bg-deep p-4">
          <p className="section-mark mb-1" style={{ color: "var(--color-unit-available)" }}>
            ✓ Reservada
          </p>
          <p className="text-sm text-graphite">
            Tu enganche fue procesado. El equipo Celsius te contactará para
            coordinar la firma de la promesa de compraventa (60 días).
          </p>
        </div>
      ) : holdActive ? (
        <div className="mb-6 flex items-center justify-between border border-accent/40 bg-deep p-4">
          <span className="section-mark !text-accent">■ Unidad apartada para ti</span>
          <HoldCountdown expiresAt={quote.hold_expires_at!} />
        </div>
      ) : (
        <div className="mb-6 border border-unit-held bg-deep p-4">
          <p className="text-sm text-unit-held">
            El apartado expiró o la cotización ya no está activa (
            {quote.status}). Genera una nueva desde el catálogo o contacta a tu
            broker.
          </p>
        </div>
      )}

      <div className="border border-hairline bg-deep p-5">
        <p className="section-mark mb-4">Esquema financiero</p>
        <dl className="space-y-2 text-sm">
          <Row k="Precio lista" v={formatMXN(quote.list_price_mxn)} />
          {(quote.discounts ?? []).map((d) => (
            <Row key={d.concept} k={d.concept} v={`−${formatMXN(d.amount)}`} accent />
          ))}
          <Row k="Precio neto" v={formatMXN(quote.net_price_mxn)} strong />
          <Row
            k={`Enganche (${quote.down_payment_pct}%)`}
            v={formatMXN(quote.down_payment_mxn)}
          />
          {quote.months > 0 ? (
            <Row
              k={`${quote.months} mensualidades durante obra`}
              v={`${formatMXN(quote.monthly_payment_mxn)} /mes`}
            />
          ) : null}
          <Row k="Saldo al cierre" v={formatMXN(quote.balance_at_close_mxn)} />
        </dl>
      </div>

      {holdActive && !quote.paid ? (
        <Link
          href={`/portal/cotizacion/${quote.id}/pago`}
          className="mt-6 block w-full bg-accent px-4 py-3 text-center text-sm font-medium text-deep hover:bg-accent-hover"
        >
          Pagar enganche de {formatMXN(quote.down_payment_mxn)} →
        </Link>
      ) : null}
    </div>
  );
}

function Row({ k, v, strong, accent }: { k: string; v: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-hairline pb-1.5 ${strong ? "text-base" : ""}`}>
      <dt className="text-graphite">{k}</dt>
      <dd className={accent ? "text-accent" : ""}>{v}</dd>
    </div>
  );
}
