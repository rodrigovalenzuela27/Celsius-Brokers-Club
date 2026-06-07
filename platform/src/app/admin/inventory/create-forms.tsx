"use client";

import { useActionState } from "react";
import {
  createProject,
  createUnit,
  type ActionState,
} from "./actions";

const field =
  "border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-stone focus:border-accent";

export function CreateProjectForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createProject,
    {},
  );

  return (
    <form action={action} className="border border-hairline bg-deep p-5">
      <p className="section-mark mb-4">+ Nuevo proyecto</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <input name="code" placeholder="Código · SOL-2026" required className={field} />
        <input name="name" placeholder="Nombre" required className={field} />
        <input name="location" placeholder="Ubicación" required className={field} />
        <select name="status" defaultValue="presale" className={field}>
          <option value="presale">Pre-venta</option>
          <option value="selling">Venta activa</option>
        </select>
        <input name="delivery_date" type="month" className={field} />
        <input
          name="levels"
          type="number"
          min={1}
          max={80}
          placeholder="Niveles"
          required
          className={field}
        />
      </div>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-400">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 text-sm text-unit-available">✓ Proyecto creado</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 bg-accent px-4 py-2 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear proyecto"}
      </button>
    </form>
  );
}

export function CreateUnitForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createUnit,
    {},
  );

  return (
    <form action={action} className="border border-hairline bg-deep p-5">
      <p className="section-mark mb-4">+ Nueva unidad</p>
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input name="unit_number" placeholder="Número · 0805" required className={field} />
        <input name="floor" type="number" min={1} placeholder="Piso" required className={field} />
        <input name="pos" type="number" min={1} placeholder="Posición en planta" required className={field} />
        <input name="m2" type="number" min={1} step="0.5" placeholder="m²" required className={field} />
        <input name="bedrooms" type="number" min={0} placeholder="Recámaras" required className={field} />
        <input name="bathrooms" type="number" min={0} step="0.5" placeholder="Baños" required className={field} />
        <input name="parking_spots" type="number" min={0} placeholder="Cajones" required className={field} />
        <input
          name="list_price_mxn"
          type="number"
          min={1}
          step="1000"
          placeholder="Precio lista MXN"
          required
          className={field}
        />
      </div>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-400">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 text-sm text-unit-available">✓ Unidad creada</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 bg-accent px-4 py-2 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear unidad"}
      </button>
    </form>
  );
}
