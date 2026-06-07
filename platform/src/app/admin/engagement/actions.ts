"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markAttendance(formData: FormData): Promise<void> {
  await requireProfile(["admin"]);
  const id = z.uuid().safeParse(formData.get("registration_id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc("mark_event_attendance", { p_registration_id: id.data });
  revalidatePath("/admin/engagement");
}

/** Genera los slots de guardia de la próxima semana (idempotente). */
export async function generateDutySlots(): Promise<void> {
  const profile = await requireProfile(["admin"]);
  const supabase = await createClient();

  const { data: rooms } = await supabase
    .from("room")
    .select("showroom")
    .returns<{ showroom: string }[]>();
  const showrooms = [...new Set((rooms ?? []).map((r) => r.showroom))];

  const slots = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
    for (const showroom of showrooms) {
      for (const shift of ["matutino", "vespertino"]) {
        slots.push({
          developer_id: profile.developer_id,
          showroom,
          duty_date: date,
          shift,
        });
      }
    }
  }
  // upsert ignorando los que ya existen (unique developer+showroom+fecha+turno)
  await supabase
    .from("duty_slot")
    .upsert(slots, { onConflict: "developer_id,showroom,duty_date,shift", ignoreDuplicates: true });
  revalidatePath("/admin/engagement");
}
