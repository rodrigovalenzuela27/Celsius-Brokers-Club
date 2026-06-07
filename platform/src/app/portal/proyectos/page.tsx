import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMXN, formatDate } from "@/lib/format";
import {
  PROJECT_STATUS_LABEL,
  type Project,
  type UnitStatus,
} from "@/lib/types";

type UnitAgg = { project_id: string; status: UnitStatus; list_price_mxn: number };

/** Catálogo público (anon): proyectos en comercialización vía RLS. */
export default async function PublicCatalog() {
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="section-mark mb-2">§ Proyectos</p>
      <h1 className="mb-1 text-3xl font-normal tracking-tight">
        Inventario en vivo
      </h1>
      <p className="mb-10 text-sm text-graphite">
        Disponibilidad real, directa de la base de datos — la misma que ven
        los brokers.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(projects ?? []).map((p) => {
          const rows = (unitRows ?? []).filter((u) => u.project_id === p.id);
          const available = rows.filter((u) => u.status === "available").length;
          const prices = rows.map((u) => u.list_price_mxn);
          return (
            <Link
              key={p.id}
              href={`/portal/proyectos/${p.id}`}
              className="group border border-hairline bg-deep p-6 transition-colors hover:border-accent"
            >
              <p className="section-mark mb-3">{p.code}</p>
              <h2 className="text-xl">{p.name}</h2>
              <p className="mb-4 text-sm text-graphite">{p.location}</p>
              <dl className="space-y-1 text-sm text-graphite">
                <div className="flex justify-between">
                  <dt>Disponibles</dt>
                  <dd className="text-ink">{available} de {rows.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Desde</dt>
                  <dd className="text-ink">
                    {prices.length ? formatMXN(Math.min(...prices)) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Entrega</dt>
                  <dd className="text-ink">{formatDate(p.delivery_date)}</dd>
                </div>
              </dl>
              <p className="mt-4 flex items-center justify-between text-xs uppercase tracking-wider text-accent">
                {PROJECT_STATUS_LABEL[p.status]}
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
