"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: string };

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
  okMsg: string,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message.replace(/^.*?: /, "") };
  const r = data as { error?: string; points?: number };
  if (r.error) return { error: r.error };
  revalidatePath("/broker/community");
  return { ok: r.points ? `${okMsg} · +${r.points} pts` : okMsg };
}

export async function registerEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile(["broker_internal", "broker_external"]);
  const id = z.uuid().safeParse(formData.get("event_id"));
  if (!id.success) return { error: "Evento inválido" };
  return callRpc("register_event", { p_event_id: id.data }, "Registrado");
}

export async function enrollCourse(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile(["broker_internal", "broker_external"]);
  const id = z.uuid().safeParse(formData.get("course_id"));
  if (!id.success) return { error: "Curso inválido" };
  return callRpc("enroll_course", { p_course_id: id.data }, "Inscrito");
}

export async function completeCourse(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile(["broker_internal", "broker_external"]);
  const id = z.uuid().safeParse(formData.get("course_id"));
  if (!id.success) return { error: "Curso inválido" };
  return callRpc("complete_course", { p_course_id: id.data }, "Curso completado");
}
