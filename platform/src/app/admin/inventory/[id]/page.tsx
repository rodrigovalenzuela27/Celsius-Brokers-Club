import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UNIT_STATUS_LABEL, type Project, type Unit, type UnitStatus } from "@/lib/types";
import { updateUnit } from "../actions";
import { CreateUnitForm } from "../create-forms";

const STATUSES: UnitStatus[] = ["available", "held", "reserved", "sold", "inactive"];

/** Unidades de un proyecto: edición de precio/estado + alta de unidad. */
export default async function ProjectUnitsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: units }] = await Promise.all([
    supabase
      .from("project")
      .select("id, code, name, location, address, status, delivery_date, levels, tech_specs")
      .eq("id", id)
      .maybeSingle<Project>(),
    supabase
      .from("unit")
      .select(
        "id, project_id, unit_number, floor, m2, bedrooms, bathrooms, parking_spots, has_storage, orientation, view_description, list_price_mxn, status, svg_coords",
      )
      .eq("project_id", id)
      .order("floor", { ascending: false })
      .order("unit_number")
      .returns<Unit[]>(),
  ]);

  if (!project) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/inventory" className="section-mark hover:text-accent">
        ← Inventario
      </Link>
      <h1 className="mb-1 mt-4 text-2xl font-normal tracking-tight">
        {project.name} <span className="font-mono text-sm text-graphite">{project.code}</span>
      </h1>
      <p className="mb-8 text-sm text-graphite">
        {units?.length ?? 0} unidades. Edita precio o estado y guarda por fila —
        cada cambio queda en el audit log.
      </p>

      <div className="mb-8 max-h-[28rem] overflow-y-auto border border-hairline">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-deep">
            <tr className="text-left">
              {["Unidad", "Piso", "m²", "Rec", "Baños", "Precio lista MXN", "Estado", ""].map((h) => (
                <th key={h} scope="col" className="section-mark px-3 py-2.5 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(units ?? []).map((u) => (
              <tr key={u.id} className="border-t border-hairline">
                <td className="px-3 py-2 font-mono text-xs">{u.unit_number}</td>
                <td className="px-3 py-2">{u.floor}</td>
                <td className="px-3 py-2">{u.m2}</td>
                <td className="px-3 py-2">{u.bedrooms}</td>
                <td className="px-3 py-2">{u.bathrooms}</td>
                {/* Un form por fila: action server-side, validación Zod + RLS */}
                <td className="px-3 py-2" colSpan={3}>
                  <form action={updateUnit} className="flex items-center gap-2">
                    <input type="hidden" name="unit_id" value={u.id} />
                    <input type="hidden" name="project_id" value={u.project_id} />
                    <input
                      name="list_price_mxn"
                      type="number"
                      min={1}
                      step="1000"
                      defaultValue={u.list_price_mxn}
                      className="w-36 border border-hairline-strong bg-canvas px-2 py-1.5 text-right text-xs outline-none focus:border-accent"
                    />
                    <select
                      name="status"
                      defaultValue={u.status}
                      className="border border-hairline-strong bg-canvas px-2 py-1.5 text-xs outline-none focus:border-accent"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {UNIT_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="border border-hairline px-3 py-1.5 text-xs text-graphite hover:border-accent hover:text-accent"
                    >
                      Guardar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateUnitForm projectId={project.id} />
    </div>
  );
}
