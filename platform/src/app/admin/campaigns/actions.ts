"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type CampaignState = { error?: string; ok?: boolean };

const schema = z.object({
  title: z.string().min(3, "Título requerido"),
  body: z.string().min(10, "Mensaje requerido (mín. 10 caracteres)"),
  cta_label: z.string().optional().or(z.literal("")),
  cta_href: z.string().optional().or(z.literal("")),
  format: z.enum(["popup", "banner"]),
  audience: z.enum(["brokers", "clients", "both"]),
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export async function createCampaign(
  _prev: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const profile = await requireProfile(["admin"]);

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("campaign").insert({
    developer_id: profile.developer_id,
    title: parsed.data.title,
    body: parsed.data.body,
    cta_label: parsed.data.cta_label || null,
    cta_href: parsed.data.cta_href || null,
    format: parsed.data.format,
    audience: parsed.data.audience,
    starts_at: parsed.data.starts_at,
    ends_at: parsed.data.ends_at || null,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo crear la campaña (${error.code})` };
  revalidatePath("/admin/campaigns");
  return { ok: true };
}

export async function toggleCampaign(formData: FormData): Promise<void> {
  await requireProfile(["admin"]);
  const parsed = z
    .object({ campaign_id: z.uuid(), active: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("campaign")
    .update({ active: parsed.data.active === "true" })
    .eq("id", parsed.data.campaign_id);
  revalidatePath("/admin/campaigns");
}
