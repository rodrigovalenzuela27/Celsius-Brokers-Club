"use client";

import { useActionState } from "react";
import { createPaymentRun, type RunState } from "./actions";

export function CreateRunForm({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState<RunState, FormData>(
    createPaymentRun,
    {},
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input
        type="date"
        name="run_date"
        defaultValue={defaultDate}
        required
        className="border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-accent px-4 py-2 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear payment run"}
      </button>
      {state.error ? <span className="text-sm text-red-400">{state.error}</span> : null}
      {state.ok ? <span className="text-sm text-unit-available">✓ {state.ok}</span> : null}
    </form>
  );
}
