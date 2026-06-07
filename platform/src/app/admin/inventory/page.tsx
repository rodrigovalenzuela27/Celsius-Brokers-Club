import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import {
  PROJECT_STATUS_LABEL,
  type Project,
  type UnitStatus,
} from "@/lib/types";
import { CreateProjectForm } from "./create-forms";

type UnitAgg = { project_id: string; status: UnitStatus };

/** Inventario maestro (F14): proyectos con métricas y alta de proyecto. */
export default async function InventoryPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: unitRows }] = await Promise.all([
    supabase
      .from("project")
      .select("id, code, name, location, address, status, delivery_date, levels, tech_specs")
      .order("name")
      .returns<Project[]>(),
    supabase.from("unit").select("project_id, status").returns<UnitAgg[]>(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§02 · Inventario</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">
        Proyectos & unidades
      </h1>
      <p className="mb-8 text-sm text-graphite">
        CRUD del inventario maestro. Cada mutación queda en el audit log.
      </p>

      <table className="mb-8 w-full border border-hairline text-sm">
        <thead>
          <tr className="bg-deep text-left">
            {["Código", "Proyecto", "Ubicación", "Estado", "Entrega", "Unidades", "Disponibles", ""].map(
              (h) => (
                <th key={h} scope="col" className="section-mark px-4 py-3 font-normal">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {(projects ?? []).map((p) => {
            const rows = (unitRows ?? []).filter((u) => u.project_id === p.id);
            const avail = rows.filter((u) => u.status === "available").length;
            return (
              <tr key={p.id} className="border-t border-hairline hover:bg-deep">
                <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 text-graphite">{p.location}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wider text-accent">
                  {PROJECT_STATUS_LABEL[p.status]}
                </td>
                <td className="px-4 py-3">{formatDate(p.delivery_date)}</td>
                <td className="px-4 py-3">{rows.length}</td>
                <td className="px-4 py-3">{avail}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/inventory/${p.id}`}
                    className="text-accent hover:text-accent-hover"
                  >
                    Unidades →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <CreateProjectForm />
    </div>
  );
}
