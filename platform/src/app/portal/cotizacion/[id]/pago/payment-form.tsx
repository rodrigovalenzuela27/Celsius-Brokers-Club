"use client";

import { useActionState, useState } from "react";
import { payDownPayment, type PayState } from "./actions";

const field =
  "border border-hairline-strong bg-canvas px-3.5 py-3 text-sm text-ink outline-none placeholder:text-stone focus:border-accent";

export function PaymentForm({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState<PayState, FormData>(
    payDownPayment,
    {},
  );
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="quote_id" value={quoteId} />

      <label className="flex flex-col gap-1.5">
        <span className="section-mark">Número de tarjeta</span>
        <input
          name="card_number"
          required
          inputMode="numeric"
          autoComplete="cc-number"
          maxLength={23}
          value={num}
          onChange={(e) =>
            setNum(
              e.target.value
                .replace(/\D/g, "")
                .replace(/(\d{4})(?=\d)/g, "$1 ")
                .slice(0, 23),
            )
          }
          placeholder="0000 0000 0000 0000"
          className={`${field} font-mono`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="section-mark">Titular</span>
        <input
          name="card_name"
          required
          autoComplete="cc-name"
          placeholder="Como aparece en la tarjeta"
          className={`${field} uppercase`}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="section-mark">Vencimiento</span>
          <input
            name="card_exp"
            required
            inputMode="numeric"
            autoComplete="cc-exp"
            maxLength={5}
            value={exp}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
              setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
            }}
            placeholder="MM/AA"
            className={`${field} font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="section-mark">CVC</span>
          <input
            name="card_cvc"
            required
            inputMode="numeric"
            autoComplete="cc-csc"
            maxLength={4}
            placeholder="123"
            className={`${field} font-mono`}
          />
        </label>
      </div>

      <label className="mt-2 flex items-start gap-2 text-xs text-graphite">
        <input type="checkbox" name="terms" required className="mt-0.5 accent-(--color-accent)" />
        Acepto los términos del apartado: si cancelo después del pago aplica
        una penalización del 5% sobre el enganche; tengo 60 días para firmar la
        promesa de compraventa.
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 bg-accent px-4 py-3 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Procesando…" : "Pagar enganche →"}
      </button>
      <p className="text-center text-xs text-graphite">
        Entorno de prueba — usa 4242 4242 4242 4242. Celsius nunca almacena los
        datos de tu tarjeta.
      </p>
    </form>
  );
}
