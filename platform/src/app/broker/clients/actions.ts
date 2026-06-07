"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean };

const PRIVACY_VERSION = "v3.2"; // versión vigente del aviso de privacidad

const clientSchema = z.object({
  full_name: z.string().min(3, "Nombre completo requerido"),
  email: z.email("Correo inválido"),
  phone: z
    .string()
    .regex(/^\+?[\d\s-]{10,15}$/, "Teléfono inválido (10 dígitos)")
    .optional()
    .or(z.literal("")),
  rfc: z
    .string()
    .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i, "RFC con formato inválido")
    .optional()
    .or(z.literal("")),
  curp: z
    .string()
    .regex(/^[A-Z]\d{0,17}[A-Z0-9]{17}$|^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i, "CURP con formato inválido")
    .optional()
    .or(z.literal("")),
  consent: z.literal("on", {
    error: "El cliente debe aceptar el aviso de privacidad (LFPDPPP)",
  }),
});

export async function createClientRecord(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile(["broker_internal", "broker_external"]);

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("client").insert({
    developer_id: profile.developer_id,
    broker_id: profile.id,
    full_name: parsed.data.full_name,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone || null,
    rfc: parsed.data.rfc ? parsed.data.rfc.toUpperCase() : null,
    curp: parsed.data.curp ? parsed.data.curp.toUpperCase() : null,
    consent_at: new Date().toISOString(),
    consent_version: PRIVACY_VERSION,
  });

  if (error) return { error: `No se pudo crear el cliente (${error.code}).` };

  revalidatePath("/broker/clients");
  return { ok: true };
}
