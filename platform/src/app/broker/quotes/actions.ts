"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
