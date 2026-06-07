"use client";

import { useActionState } from "react";
import { createCampaign, type CampaignState } from "./actions";

const field =
  "border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-stone focus:border-accent";

export function CampaignForm() {
  const [state, action, pending] = useActionState<CampaignState, FormData>(
    createCampaign,
    {},
  );

  return (
    <form action={action} className="border border-hairline bg-deep p-5">
      <p className="section-mark mb-4">+ Nueva campaña</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="title" placeholder="Título *" required className={field} />
        <input name="cta_label" placeholder="Texto del CTA (opcional)" className={field} />
        <textarea
          name="body"
          placeholder="Mensaje *"
          required
          rows={2}
          className={`${field} resize-none sm:col-span-2`}
        />
        <input name="cta_href" placeholder="Link del CTA · /broker/rewards" className={field} />
        <select name="format" defaultValue="popup" className={field}>
          <option value="popup">Pop-up (al entrar)</option>
          <option value="banner">Banner (sticky)</option>
        </select>
        <select name="audience" defaultValue="brokers" className={field}>
          <option value="brokers">Brokers</option>
          <option value="clients">Clientes (portal)</option>
          <option value="both">Ambos</option>
        </select>
        <div className="flex gap-3">
          <input name="starts_at" type="date" required className={field} />
          <input name="ends_at" type="date" className={field} />
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-400">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 text-sm text-unit-available">✓ Campaña creada y activa</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 bg-accent px-4 py-2 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Creando…" : "Publicar campaña"}
      </button>
    </form>
  );
}
