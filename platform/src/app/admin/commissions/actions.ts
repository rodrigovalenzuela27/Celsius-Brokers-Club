"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type RunState = { error?: string; ok?: string };

export async function createPaymentRun(
  _prev: RunState,
  formData: FormData,
): Promise<RunState> {
  await requireProfile(["admin"]);

  const parsed = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .safeParse(formData.get("run_date"));
  if (!parsed.success) return { error: "Fecha inválida" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_payment_run", {
    p_run_date: parsed.data,
  });
  if (error) return { error: error.message.replace(/^.*?: /, "") };

  revalidatePath("/admin/commissions");
  const r = data as { commissions: number; gross_mxn: number };
  return { ok: `Run creado: ${r.commissions} comisiones por ${r.gross_mxn.toLocaleString("es-MX")} MXN` };
}

export async function approveRun(formData: FormData): Promise<void> {
  await requireProfile(["admin"]);
  const id = z.uuid().safeParse(formData.get("run_id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc("approve_payment_run", { p_run_id: id.data });
  revalidatePath("/admin/commissions");
}

export async function processRun(formData: FormData): Promise<void> {
  await requireProfile(["admin"]);
  const id = z.uuid().safeParse(formData.get("run_id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc("process_payment_run", { p_run_id: id.data });
  revalidatePath("/admin/commissions");
}
