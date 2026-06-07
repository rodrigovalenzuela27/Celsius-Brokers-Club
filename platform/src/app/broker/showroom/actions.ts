"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: string };

type RpcResult = { error?: string; ok?: boolean };

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
  okMsg: string,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message.replace(/^.*?: /, "") };
  const r = data as RpcResult;
  if (r.error) return { error: r.error };
  revalidatePath("/broker/showroom");
  return { ok: okMsg };
}

const bookSchema = z.object({
  room_id: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  minutes: z.coerce.number().refine((m) => [30, 60, 90].includes(m)),
  purpose: z.string().max(200).optional().or(z.literal("")),
  client_name: z.string().max(120).optional().or(z.literal("")),
});

export async function bookRoom(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile(["broker_internal", "broker_external"]);
  const parsed = bookSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Revisa sala, fecha y horario" };

  return callRpc(
    "book_room",
    {
      p_room_id: parsed.data.room_id,
      p_starts_at: `${parsed.data.date}T${parsed.data.time}:00-06:00`,
      p_minutes: parsed.data.minutes,
      p_purpose: parsed.data.purpose || null,
      p_client_name: parsed.data.client_name || null,
    },
    "Sala reservada",
  );
}

export async function cancelBooking(formData: FormData): Promise<void> {
  await requireProfile(["broker_internal", "broker_external", "admin"]);
  const id = z.uuid().safeParse(formData.get("booking_id"));
  if (!id.success) return;
  await callRpc("cancel_booking", { p_booking_id: id.data }, "");
}

export async function claimDuty(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile(["broker_internal", "broker_external"]);
  const id = z.uuid().safeParse(formData.get("slot_id"));
  if (!id.success) return { error: "Guardia inválida" };
  return callRpc("claim_duty", { p_slot_id: id.data }, "Guardia tomada · +30 pts");
}
