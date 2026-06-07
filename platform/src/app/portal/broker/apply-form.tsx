"use client";

import { useActionState } from "react";
import { submitApplication, type ApplyState } from "./actions";

const field =
  "border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-stone focus:border-accent";

const DOCS = [
  { type: "ine", label: "INE o pasaporte *" },
  { type: "rfc", label: "Constancia de situación fiscal *" },
  { type: "domicilio", label: "Comprobante de domicilio (<3 meses) *" },
  { type: "bancaria", label: "Carátula bancaria *" },
];

export function ApplyForm() {
  const [state, action, pending] = useActionState<ApplyState, FormData>(
    submitApplication,
    {},
  );

  if (state.folio) {
    return (
      <div className="border border-unit-available bg-deep p-8 text-center">
        <p className="section-mark mb-2" style={{ color: "var(--color-unit-available)" }}>
          ✓ Solicitud recibida
        </p>
        <p className="mb-3 font-mono text-2xl tracking-wider">{state.folio}</p>
        <p className="text-sm text-graphite">
          Validación documental (1 día) → revisión del equipo Celsius (1–2
          días) → si es aprobada, recibirás tus credenciales de acceso.
          Respuesta máxima: 3 días hábiles.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <div className="border border-hairline bg-deep p-5">
        <p className="section-mark mb-4">01 · Datos personales</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="full_name" placeholder="Nombre completo *" required className={field} />
          <input name="email" type="email" placeholder="Correo profesional *" required className={field} />
          <input name="phone" placeholder="Teléfono · 55 0000 0000 *" required className={field} />
          <select name="city" required defaultValue="" className={field}>
            <option value="" disabled>Ciudad *</option>
            {["CDMX", "Guadalajara", "Monterrey", "Otra"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="experience" required defaultValue="" className={field}>
            <option value="" disabled>Años de experiencia *</option>
            <option value="0-2">0–2</option>
            <option value="3-5">3–5</option>
            <option value="5-10">5–10</option>
            <option value="10+">10+</option>
          </select>
          <select name="specialty" required defaultValue="" className={field}>
            <option value="" disabled>Especialidad *</option>
            {["Residencial nuevo", "Residencial usado", "Comercial", "Lujo"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            name="brokerage_name"
            placeholder="Inmobiliaria (si tienes afiliación)"
            className={`${field} sm:col-span-2`}
          />
        </div>
      </div>

      <div className="border border-hairline bg-deep p-5">
        <p className="section-mark mb-1">02 · Documentación</p>
        <p className="mb-4 text-xs text-graphite">PDF, JPG o PNG · máximo 5 MB por archivo</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DOCS.map((d) => (
            <label key={d.type} className="flex flex-col gap-1.5 text-sm">
              <span className="text-graphite">{d.label}</span>
              <input
                type="file"
                name={`doc_${d.type}`}
                required
                accept=".pdf,.jpg,.jpeg,.png"
                className="border border-hairline-strong bg-canvas px-3 py-2 text-xs text-graphite file:mr-3 file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-deep"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="border border-hairline bg-deep p-5">
        <p className="section-mark mb-3">03 · Motivación</p>
        <textarea
          name="motivation"
          rows={3}
          placeholder="Cuéntanos de tu cartera y por qué te interesa vender Celsius (opcional)"
          className={`${field} w-full resize-none`}
        />
        <label className="mt-4 flex items-start gap-2 text-xs text-graphite">
          <input type="checkbox" name="consent" required className="mt-0.5 accent-(--color-accent)" />
          Acepto el tratamiento de mis datos para validación documental
          (LFPDPPP) y, en caso de aprobación, la firma del convenio digital de
          comisiones, exclusividad de cliente y confidencialidad.
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-accent px-4 py-3 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar solicitud →"}
      </button>
    </form>
  );
}
