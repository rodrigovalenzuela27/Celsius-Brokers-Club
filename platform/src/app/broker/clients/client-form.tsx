"use client";

import { useActionState } from "react";
import { createClientRecord, type ActionState } from "./actions";

const field =
  "border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-stone focus:border-accent";

export function NewClientForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createClientRecord,
    {},
  );

  return (
    <form action={action} className="border border-hairline bg-deep p-5">
      <p className="section-mark mb-4">+ Alta de cliente</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input name="full_name" placeholder="Nombre completo *" required className={field} />
        <input name="email" type="email" placeholder="Correo *" required className={field} />
        <input name="phone" placeholder="Teléfono · 55 0000 0000" className={field} />
        <input name="rfc" placeholder="RFC" className={`${field} uppercase`} maxLength={13} />
        <input name="curp" placeholder="CURP" className={`${field} uppercase`} maxLength={18} />
      </div>
      <label className="mt-4 flex items-start gap-2 text-xs text-graphite">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-(--color-accent)" />
        El cliente aceptó el aviso de privacidad v3.2 (LFPDPPP). Se registra
        fecha y versión del consentimiento.
      </label>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-400">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 text-sm text-unit-available">✓ Cliente creado</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 bg-accent px-4 py-2 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Dar de alta"}
      </button>
    </form>
  );
}
