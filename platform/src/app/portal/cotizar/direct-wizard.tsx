"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { formatMXN } from "@/lib/format";
import { computeQuote } from "@/lib/quote-engine";
import { createDirectQuote, type DirectQuoteState } from "./actions";

const field =
  "border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-stone focus:border-accent";

export function DirectWizard({
  unitId,
  listPrice,
  presaleBonusPct,
  directBonusPct,
}: {
  unitId: string;
  listPrice: number;
  presaleBonusPct: number;
  directBonusPct: number;
}) {
  const [state, action, pending] = useActionState<DirectQuoteState, FormData>(
    createDirectQuote,
    {},
  );
  const [down, setDown] = useState(20);
  const [during, setDuring] = useState(20);
  const [months, setMonths] = useState(18);

  const preview = useMemo(
    () =>
      computeQuote(
        listPrice,
        presaleBonusPct,
        { downPaymentPct: down, duringWorksPct: during, months },
        directBonusPct,
      ),
    [listPrice, presaleBonusPct, directBonusPct, down, during, months],
  );

  return (
    <form action={action} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <input type="hidden" name="unit_id" value={unitId} />

      <div className="space-y-6 border border-hairline bg-deep p-5">
        <div>
          <p className="section-mark mb-3">Paso 2 · Tus datos</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input name="full_name" placeholder="Nombre completo *" required className={field} />
            <input name="email" type="email" placeholder="Correo *" required className={field} />
            <input name="phone" placeholder="Teléfono · 55 0000 0000" className={field} />
            <input name="rfc" placeholder="RFC (para tu factura)" maxLength={13} className={`${field} uppercase`} />
          </div>
        </div>

        <div>
          <p className="section-mark mb-3">Paso 3 · Esquema de pago</p>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 flex justify-between text-graphite">
                <span>Enganche</span>
                <span className="text-ink">{down}%</span>
              </span>
              <input
                type="range"
                name="down_payment_pct"
                min={10}
                max={50}
                step={5}
                value={down}
                onChange={(e) => setDown(Number(e.target.value))}
                className="w-full accent-(--color-accent)"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 flex justify-between text-graphite">
                <span>Durante obra</span>
                <span className="text-ink">{during}%</span>
              </span>
              <input
                type="range"
                name="during_works_pct"
                min={0}
                max={40}
                step={5}
                value={during}
                onChange={(e) => setDuring(Number(e.target.value))}
                className="w-full accent-(--color-accent)"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-graphite">Mensualidades durante obra</span>
              <select
                name="months"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className={`${field} w-full`}
              >
                {[0, 6, 12, 18, 24, 36].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "Sin pagos en obra" : `${m} mensualidades`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <label className="flex items-start gap-2 text-xs text-graphite">
          <input type="checkbox" name="consent" required className="mt-0.5 accent-(--color-accent)" />
          Acepto el aviso de privacidad v3.2 (LFPDPPP) y las condiciones del
          apartado: vigencia 24 h, reembolso parcial con penalización del 5% en
          caso de cancelación posterior al pago.
        </label>
      </div>

      <div className="border border-hairline bg-deep p-5">
        <p className="section-mark mb-4">Paso 4 · Tu cotización (estimación)</p>
        <dl className="space-y-2 text-sm">
          <Row k="Precio lista" v={formatMXN(preview.listPrice)} />
          {preview.discounts.map((d) => (
            <Row key={d.concept} k={d.concept} v={`−${formatMXN(d.amount)}`} accent />
          ))}
          <Row k="Precio neto" v={formatMXN(preview.netPrice)} strong />
          <Row k={`Enganche (${down}%)`} v={formatMXN(preview.downPayment)} />
          {months > 0 ? (
            <Row k={`${months} mensualidades`} v={`${formatMXN(preview.monthlyPayment)} /mes`} />
          ) : null}
          <Row k="Saldo al cierre" v={formatMXN(preview.balanceAtClose)} />
        </dl>

        {state.error ? (
          <p role="alert" className="mt-4 text-sm text-red-400">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full bg-accent px-4 py-3 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Generando…" : "Generar cotización y apartar 24h →"}
        </button>
        <p className="mt-3 text-xs text-graphite">
          La unidad queda apartada a tu nombre por 24 horas. El monto final lo
          calcula el servidor con el precio vigente.
        </p>
      </div>
    </form>
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
