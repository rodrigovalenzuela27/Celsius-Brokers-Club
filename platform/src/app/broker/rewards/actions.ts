"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type RedeemState = { error?: string; ok?: string };

export async function redeemReward(
  _prev: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  await requireProfile(["broker_internal", "broker_external"]);

  const itemId = z.uuid().safeParse(formData.get("item_id"));
  if (!itemId.success) return { error: "Recompensa inválida" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_reward", {
    p_item_id: itemId.data,
  });

  if (error) return { error: error.message.replace(/^.*?: /, "") };

  const result = data as { ok?: boolean; item?: string; points?: number; error?: string };
  if (result.error) return { error: result.error };

  revalidatePath("/broker/rewards");
  return { ok: `Canjeaste "${result.item}" por ${result.points} pts. El equipo te contacta para la entrega.` };
}
