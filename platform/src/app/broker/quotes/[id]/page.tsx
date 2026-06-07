import Link from "next/link";
import { notFound } from "next/navigation";
import { HoldCountdown } from "@/components/hold-countdown";
import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/format";
import type { Discount } from "@/lib/quote-engine";
import { releaseHold } from "../actions";
import { ShareCode } from "./share-code";

type QuoteDetail = {
  id: string;
  folio: string;
  status: string;
  list_price_mxn: number;
  discounts: Discount[];
  net_price_mxn: number;
  down_payment_pct: number;
  down_payment_mxn: number;
  months: number;
  monthly_payment_mxn: number;
  balance_at_close_mxn: number;
  valid_until: string | null;
  created_at: string;
  unit: {
    unit_number: string;
    m2: number;
    bedrooms: number;
    bathrooms: number;
    floor: number;
    project: { name: string; code: string };
  };
  client: { full_name: string; email: string; rfc: string | null };
};

type Hold = { id: string; expires_at: string; released_at: string | null; reserved_at: string | null };

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: quote }, { data: hold }] = await Promise.all([
    supabase
      .from("quote")
      .select(
        "id, folio, status, list_price_mxn, discounts, net_price_mxn, down_payment_pct, down_payment_mxn, months, monthly_payment_mxn, balance_at_close_mxn, valid_until, created_at, unit:unit_id(unit_number, m2, bedrooms, bathrooms, floor, project:project_id(name, code)), client:client_id(full_name, email, rfc)",
      )
      .eq("id", id)
      .maybeSingle<QuoteDetail>(),
    supabase
      .from("unit_hold")
      .select("id, expires_at, released_at, reserved_at")
      .eq("quote_id", id)
      .is("released_at", null)
      .maybeSingle<Hold>(),
  ]);

  if (!quote) notFound();

  const holdActive = hold && !hold.reserved_at;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/broker/quotes" className="section-mark hover:text-accent">
        ← Mis cotizaciones
      </Link>

      <div className="mb-6 mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-mark mb-2">Cotización · {quote.folio}</p>
          <h1 className="text-2xl font-normal tracking-tight">
            {quote.unit.project.name} · Depto {quote.unit.unit_number}
          </h1>
          <p className="text-sm text-graphite">
            {quote.client.full_name} · {quote.client.email}
            {quote.client.rfc ? ` · RFC ${quote.client.rfc}` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href={`/broker/quotes/${quote.id}/pdf`}
            target="_blank"
            className="border border-accent px-4 py-2 text-sm text-accent transition-colors hover:bg-accent hover:text-deep"
          >
            Descargar PDF →
          </a>
          {holdActive ? (
            <form action={releaseHold}>
              <input type="hidden" name="hold_id" value={hold.id} />
              <button
                type="submit"
                className="border border-hairline px-4 py-2 text-sm text-graphite hover:border-red-400 hover:text-red-400"
              >
                Liberar apartado
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {["hold_active", "sent", "reserved"].includes(quote.status) ? (
        <div className="mb-6 border border-hairline bg-deep p-4">
          <p className="section-mark mb-3">Acceso del cliente · portal</p>
          <ShareCode quoteId={quote.id} />
        </div>
      ) : null}

      {holdActive ? (
        <div className="mb-6 flex items-center justify-between border border-accent/40 bg-deep p-4">
          <span className="section-mark !text-accent">■ Unidad apartada</span>
          <HoldCountdown expiresAt={hold.expires_at} />
        </div>
      ) : (
        <div className="mb-6 border border-hairline bg-deep p-4">
          <span className="section-mark">
            Estado · {quote.status === "expired" ? "Apartado expirado — unidad liberada" : quote.status}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="border border-hairline bg-deep p-5">
          <p className="section-mark mb-4">Unidad</p>
          <dl className="space-y-2 text-sm">
            {[
              ["Proyecto", `${quote.unit.project.name} (${quote.unit.project.code})`],
              ["Unidad", quote.unit.unit_number],
              ["Superficie", `${quote.unit.m2} m²`],
              ["Recámaras / baños", `${quote.unit.bedrooms} / ${quote.unit.bathrooms}`],
              ["Piso", String(quote.unit.floor)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-hairline pb-1.5">
                <dt className="text-graphite">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border border-hairline bg-deep p-5">
          <p className="section-mark mb-4">Esquema financiero · snapshot inmutable</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-hairline pb-1.5">
              <dt className="text-graphite">Precio lista</dt>
              <dd>{formatMXN(quote.list_price_mxn)}</dd>
            </div>
            {(quote.discounts ?? []).map((d) => (
              <div key={d.concept} className="flex justify-between border-b border-hairline pb-1.5">
                <dt className="text-graphite">{d.concept}</dt>
                <dd className="text-accent">−{formatMXN(d.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-b border-hairline pb-1.5 text-base">
              <dt className="text-graphite">Precio neto</dt>
              <dd>{formatMXN(quote.net_price_mxn)}</dd>
            </div>
            <div className="flex justify-between border-b border-hairline pb-1.5">
              <dt className="text-graphite">Enganche ({quote.down_payment_pct}%)</dt>
              <dd>{formatMXN(quote.down_payment_mxn)}</dd>
            </div>
            {quote.months > 0 ? (
              <div className="flex justify-between border-b border-hairline pb-1.5">
                <dt className="text-graphite">{quote.months} mensualidades</dt>
                <dd>{formatMXN(quote.monthly_payment_mxn)} /mes</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-b border-hairline pb-1.5">
              <dt className="text-graphite">Saldo al cierre</dt>
              <dd>{formatMXN(quote.balance_at_close_mxn)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-graphite">
            Vigencia de la cotización:{" "}
            {quote.valid_until
              ? new Date(quote.valid_until).toLocaleDateString("es-MX")
              : "—"}
            . Emitida el {new Date(quote.created_at).toLocaleString("es-MX")}.
          </p>
        </div>
      </div>
    </div>
  );
}
