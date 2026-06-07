"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApplyState = { error?: string; folio?: string };

const MAX_SIZE = 5 * 1024 * 1024;
const MIMES = ["application/pdf", "image/jpeg", "image/png"];

const REQUIRED_DOCS = [
  { type: "ine", label: "INE o pasaporte" },
  { type: "rfc", label: "Constancia de situación fiscal" },
  { type: "domicilio", label: "Comprobante de domicilio" },
  { type: "bancaria", label: "Carátula bancaria" },
] as const;

const schema = z.object({
  full_name: z.string().min(3, "Nombre completo requerido"),
  email: z.email("Correo inválido"),
  phone: z.string().regex(/^\+?[\d\s-]{10,15}$/, "Teléfono inválido"),
  city: z.string().min(2, "Ciudad requerida"),
  experience: z.enum(["0-2", "3-5", "5-10", "10+"]),
  specialty: z.string().min(2),
  brokerage_name: z.string().optional().or(z.literal("")),
  motivation: z.string().max(2000).optional().or(z.literal("")),
  consent: z.literal("on", { error: "Debes aceptar el tratamiento de datos" }),
});

/**
 * Alta de solicitud de broker desde el portal (anon). Usa service role
 * porque RLS mantiene la tabla cerrada al público; toda la validación
 * (campos + tipos/tamaño de archivos) ocurre aquí.
 */
export async function submitApplication(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Validar documentos requeridos antes de tocar la DB.
  const docs: { type: string; file: File }[] = [];
  for (const doc of REQUIRED_DOCS) {
    const file = formData.get(`doc_${doc.type}`);
    if (!(file instanceof File) || file.size === 0) {
      return { error: `Falta el documento: ${doc.label}` };
    }
    if (file.size > MAX_SIZE) {
      return { error: `${doc.label}: máximo 5 MB` };
    }
    if (!MIMES.includes(file.type)) {
      return { error: `${doc.label}: solo PDF, JPG o PNG` };
    }
    docs.push({ type: doc.type, file });
  }

  const admin = createAdminClient();

  const { data: dev } = await admin
    .from("developer")
    .select("id")
    .eq("slug", "celsius")
    .single();
  if (!dev) return { error: "Error interno" };

  const { data: app, error } = await admin
    .from("broker_application")
    .insert({
      developer_id: dev.id,
      full_name: parsed.data.full_name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone,
      city: parsed.data.city,
      experience: parsed.data.experience,
      specialty: parsed.data.specialty,
      brokerage_name: parsed.data.brokerage_name || null,
      motivation: parsed.data.motivation || null,
    })
    .select("id, folio")
    .single();

  if (error || !app) return { error: "No se pudo registrar la solicitud." };

  for (const { type, file } of docs) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: docError } = await admin.from("application_document").insert({
      application_id: app.id,
      doc_type: type,
      filename: file.name,
      mime: file.type,
      size_bytes: file.size,
      content: `\\x${bytes.toString("hex")}`,
    });
    if (docError) {
      // rollback manual: sin la documentación completa la solicitud no sirve
      await admin.from("broker_application").delete().eq("id", app.id);
      return { error: `No se pudo guardar ${file.name}.` };
    }
  }

  return { folio: app.folio };
}
