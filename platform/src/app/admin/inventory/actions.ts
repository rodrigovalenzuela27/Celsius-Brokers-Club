"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean };

// ---------- Proyecto ----------
const projectSchema = z.object({
  code: z.string().regex(/^[A-Z]{3}-\d{4}$/, "Código con formato AAA-0000 (ej. SOL-2026)"),
  name: z.string().min(2, "Nombre requerido"),
  location: z.string().min(2, "Ubicación requerida"),
  status: z.enum(["presale", "selling", "sold_out", "delivered"]),
  delivery_date: z.string().regex(/^\d{4}-\d{2}$/, "Entrega con formato AAAA-MM").optional()
    .or(z.literal("")),
  levels: z.coerce.number().int().min(1).max(80),
});

export async function createProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile(["admin"]);

  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("project").insert({
    developer_id: profile.developer_id,
    code: parsed.data.code,
    name: parsed.data.name,
    location: parsed.data.location,
    status: parsed.data.status,
    delivery_date: parsed.data.delivery_date
      ? `${parsed.data.delivery_date}-01`
      : null,
    levels: parsed.data.levels,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Ya existe un proyecto con ese código."
        : `No se pudo crear el proyecto (${error.code}).`,
    };
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/broker");
  return { ok: true };
}

// ---------- Unidad ----------
const unitSchema = z.object({
  project_id: z.uuid(),
  unit_number: z.string().regex(/^\d{4}$/, "Número de unidad de 4 dígitos (piso+posición, ej. 0805)"),
  floor: z.coerce.number().int().min(1).max(80),
  pos: z.coerce.number().int().min(1).max(24),
  m2: z.coerce.number().positive().max(2000),
  bedrooms: z.coerce.number().int().min(0).max(10),
  bathrooms: z.coerce.number().min(0).max(10),
  parking_spots: z.coerce.number().int().min(0).max(10),
  list_price_mxn: z.coerce.number().positive("El precio debe ser mayor a 0"),
});

export async function createUnit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile(["admin"]);

  const parsed = unitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { pos, ...unit } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("unit").insert({
    ...unit,
    svg_coords: { floor: unit.floor, pos },
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Ya existe esa unidad en el proyecto."
        : `No se pudo crear la unidad (${error.code}).`,
    };
  }

  revalidatePath(`/admin/inventory/${parsed.data.project_id}`);
  return { ok: true };
}

// ---------- Actualización de precio / estado de unidad ----------
const unitUpdateSchema = z.object({
  unit_id: z.uuid(),
  project_id: z.uuid(),
  list_price_mxn: z.coerce.number().positive(),
  status: z.enum(["available", "held", "reserved", "sold", "inactive"]),
});

export async function updateUnit(formData: FormData): Promise<void> {
  await requireProfile(["admin"]);

  const parsed = unitUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();
  // El UPDATE queda en AUDIT_EVENT vía trigger; RLS exige rol admin.
  await supabase
    .from("unit")
    .update({
      list_price_mxn: parsed.data.list_price_mxn,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.unit_id);

  revalidatePath(`/admin/inventory/${parsed.data.project_id}`);
}
