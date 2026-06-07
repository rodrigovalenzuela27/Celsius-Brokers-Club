"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ShareCodeState = { code?: string; error?: string };

/** Genera el código de 6 dígitos (15 min) para que el cliente acceda. */
export async function generateShareCode(
  _prev: ShareCodeState,
  formData: FormData,
): Promise<ShareCodeState> {
  await requireProfile(["broker_internal", "broker_external", "admin"]);

  const quoteId = z.uuid().safeParse(formData.get("quote_id"));
  if (!quoteId.success) return { error: "Cotización inválida" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_quote_access_code", {
    p_quote_id: quoteId.data,
  });

  if (error) return { error: error.message.replace(/^.*?: /, "") };
  return { code: (data as { code: string }).code };
}

/** Libera un apartado activo (el broker desiste antes de que expire). */
export async function releaseHold(formData: FormData): Promise<void> {
  await requireProfile(["broker_internal", "broker_external", "admin"]);

  const holdId = z.uuid().safeParse(formData.get("hold_id"));
  if (!holdId.success) return;

  const supabase = await createClient();
  await supabase.rpc("release_hold", {
    p_hold_id: holdId.data,
    p_reason: "cancelled",
  });

  revalidatePath("/broker/quotes");
}
