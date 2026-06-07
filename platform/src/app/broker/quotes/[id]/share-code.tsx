"use client";

import { useActionState } from "react";
import { generateShareCode, type ShareCodeState } from "../actions";

/** El broker genera el código de 6 dígitos para compartir con el cliente. */
export function ShareCode({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState<ShareCodeState, FormData>(
    generateShareCode,
    {},
  );

  return (
    <form action={action} className="inline">
      <input type="hidden" name="quote_id" value={quoteId} />
      {state.code ? (
        <span className="mr-3 border border-accent/40 bg-deep px-3 py-2 font-mono text-sm tracking-[0.25em] text-accent">
          {state.code.slice(0, 3)} {state.code.slice(3)}
        </span>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="border border-hairline px-4 py-2 text-sm text-graphite hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {pending
          ? "Generando…"
          : state.code
            ? "Regenerar código"
            : "Compartir con cliente"}
      </button>
      {state.code ? (
        <p className="mt-2 text-xs text-graphite">
          Vence en 15 min. El cliente entra en{" "}
          <span className="text-accent">/portal/codigo</span> con su correo y
          este código.
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-2 text-xs text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
