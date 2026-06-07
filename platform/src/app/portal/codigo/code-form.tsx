"use client";

import { useActionState } from "react";
import { redeemCode, type RedeemState } from "./actions";

const field =
  "border border-hairline-strong bg-canvas px-3.5 py-3 text-sm text-ink outline-none placeholder:text-stone focus:border-accent";

export function CodeForm() {
  const [state, action, pending] = useActionState<RedeemState, FormData>(
    redeemCode,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="section-mark">Tu correo</span>
        <input
          name="email"
          type="email"
          required
          placeholder="el correo donde recibiste la cotización"
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="section-mark">Código de 6 dígitos</span>
        <input
          name="code"
          required
          inputMode="numeric"
          maxLength={7}
          placeholder="000 000"
          className={`${field} text-center font-mono text-lg tracking-[0.3em]`}
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 bg-accent px-4 py-3 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Verificando…" : "Acceder a mi cotización →"}
      </button>
      <p className="text-xs text-graphite">
        El código vence 15 minutos después de que tu broker lo genera. Si
        expiró, pídele que lo genere de nuevo.
      </p>
    </form>
  );
}
