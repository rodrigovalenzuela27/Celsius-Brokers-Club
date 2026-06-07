"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type DecisionState = { error?: string; ok?: string; tempPassword?: string };

/**
 * Aprueba una solicitud: resuelve/crea la inmobiliaria, crea la cuenta
 * broker_external vía Admin API (el trigger handle_auth_user genera el
 * profile con rol e inmobiliaria) y cierra la solicitud.
 */
export async function approveApplication(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const reviewer = await requireProfile(["admin"]);

  const id = z.uuid().safeParse(formData.get("application_id"));
  if (!id.success) return { error: "Solicitud inválida" };

  const admin = createAdminClient();
  const { data: app } = await admin
    .from("broker_application")
    .select("id, folio, full_name, email, brokerage_name, status, developer_id")
    .eq("id", id.data)
    .single();

  if (!app) return { error: "Solicitud no encontrada" };
  if (!["pending", "in_review", "needs_docs"].includes(app.status)) {
    return { error: `La solicitud ya fue decidida (${app.status})` };
  }

  // Inmobiliaria: usar la existente o crearla (independiente → "Independiente").
  const brokerageName = app.brokerage_name?.trim() || "Independiente";
  let { data: brokerage } = await admin
    .from("brokerage")
    .select("id")
    .eq("developer_id", app.developer_id)
    .ilike("name", brokerageName)
    .maybeSingle();

  if (!brokerage) {
    const { data: created, error } = await admin
      .from("brokerage")
      .insert({ developer_id: app.developer_id, name: brokerageName })
      .select("id")
      .single();
    if (error || !created) return { error: "No se pudo crear la inmobiliaria" };
    brokerage = created;
  }

  // Cuenta del broker. En cloud esto será una invitación por correo;
  // en local generamos password temporal y se lo mostramos al admin.
  const tempPassword = `celsius-${crypto.randomUUID().slice(0, 13)}`;
  const { error: userError } = await admin.auth.admin.createUser({
    email: app.email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: "broker_external", brokerage_id: brokerage.id },
    user_metadata: { full_name: app.full_name },
  });

  if (userError) {
    return { error: `No se pudo crear la cuenta: ${userError.message}` };
  }

  await admin
    .from("broker_application")
    .update({
      status: "approved",
      decided_by: reviewer.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", app.id);

  revalidatePath("/admin/applications");
  return {
    ok: `${app.folio} aprobada · cuenta creada para ${app.email}`,
    tempPassword,
  };
}

export async function rejectApplication(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const reviewer = await requireProfile(["admin"]);

  const parsed = z
    .object({ application_id: z.uuid(), notes: z.string().max(500).optional().or(z.literal("")) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("broker_application")
    .update({
      status: "rejected",
      review_notes: parsed.data.notes || null,
      decided_by: reviewer.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.application_id)
    .in("status", ["pending", "in_review", "needs_docs"]);

  if (error) return { error: "No se pudo rechazar" };
  revalidatePath("/admin/applications");
  return { ok: "Solicitud rechazada" };
}
