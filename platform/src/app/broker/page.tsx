import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/format";
import {
  PROJECT_STATUS_LABEL,
  type Project,
  type UnitStatus,
} from "@/lib/types";

type UnitAgg = { project_id: string; status: UnitStatus; list_price_mxn: number };

/**
 * Catálogo de proyectos del broker (F02 del doc de arquitectura).
 * La visibilidad la decide RLS: un broker externo solo ve los
 * proyectos con convenio de su inmobiliaria.
 */
export default async function BrokerCatalog() {
  const supabase = await createClient();

  const [{ data: projects }, { data: unitRows }] = await Promise.all([
    supabase
      .from("project")
      .select("id, code, name, location, address, status, delivery_date, levels, tech_specs")
      .order("name")
      .returns<Project[]>(),
    supabase
      .from("unit")
      .select("project_id, status, list_price_mxn")
      .returns<UnitAgg[]>(),
  ]);

  const aggFor = (projectId: string) => {
    const rows = (unitRows ?? []).filter((u) => u.project_id === projectId);
    const total = rows.length;
    const available = rows.filter((u) => u.status === "available").length;
    const prices = rows.map((u) => u.list_price_mxn);
    return {
      total,
      available,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    };
  };

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§02 · Proyectos</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">Catálogo</h1>
      <p className="mb-8 text-sm text-graphite">
        Inventario en vivo desde la base de datos. Haz clic en un proyecto para
        ver su ficha técnica y el visualizador del edificio.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(projects ?? []).map((p) => {
          const a = aggFor(p.id);
          const pct = a.total ? Math.round((a.available / a.total) * 100) : 0;
          return (
            <Link
              key={p.id}
              href={`/broker/projects/${p.id}`}
              className="group border border-hairline bg-deep p-5 transition-colors hover:border-accent"
            >
              <p className="section-mark mb-3">{p.code}</p>
              <h2 className="text-lg">{p.name}</h2>
              <p className="mb-4 text-sm text-graphite">{p.location}</p>

              <div className="mb-1 flex justify-between text-xs text-graphite">
                <span>
                  {a.available} de {a.total} disponibles
                </span>
                <span>{pct}%</span>
              </div>
              <div className="mb-4 h-1 w-full bg-stone">
                <div className="h-1 bg-accent" style={{ width: `${pct}%` }} />
              </div>

              <p className="text-xs text-graphite">
                {formatMXN(a.min)} — {formatMXN(a.max)}
              </p>
              <p className="mt-3 flex items-center justify-between text-xs uppercase tracking-wider text-accent">
                {PROJECT_STATUS_LABEL[p.status]}
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
