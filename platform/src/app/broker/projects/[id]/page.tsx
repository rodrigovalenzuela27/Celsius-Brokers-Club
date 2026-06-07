import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildingVisualizer } from "@/components/building-visualizer";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PROJECT_STATUS_LABEL, type Project, type Unit } from "@/lib/types";

/**
 * Ficha técnica de proyecto + visualizador del edificio (F03–F05).
 * Si el broker no tiene acceso al proyecto (sin convenio), RLS devuelve
 * cero filas → 404. La UI nunca decide permisos.
 */
export default async function ProjectDetail({
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
      .returns<Unit[]>(),
  ]);

  if (!project) notFound();

  const specs = project.tech_specs ?? {};

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/broker" className="section-mark hover:text-accent">
        ← Catálogo
      </Link>

      <div className="mb-8 mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-mark mb-2">
            {project.code} · {PROJECT_STATUS_LABEL[project.status]}
          </p>
          <h1 className="text-3xl font-normal tracking-tight">{project.name}</h1>
          <p className="text-sm text-graphite">{project.location}</p>
        </div>
        <dl className="flex gap-8 text-sm">
          <div>
            <dt className="section-mark">Entrega</dt>
            <dd>{formatDate(project.delivery_date)}</dd>
          </div>
          <div>
            <dt className="section-mark">Niveles</dt>
            <dd>{project.levels ?? "—"}</dd>
          </div>
          <div>
            <dt className="section-mark">Unidades</dt>
            <dd>{units?.length ?? 0}</dd>
          </div>
          {specs.certification ? (
            <div>
              <dt className="section-mark">Certificación</dt>
              <dd>{specs.certification}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <p className="section-mark mb-3">§ Visualizador · disponibilidad en vivo</p>
      <BuildingVisualizer projectId={project.id} initialUnits={units ?? []} />

      {specs.amenities?.length ? (
        <div className="mt-8 border border-hairline bg-deep p-5">
          <p className="section-mark mb-3">Amenidades</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-graphite">
            {specs.amenities.map((a) => (
              <li key={a} className="before:mr-2 before:text-accent before:content-['—']">
                {a}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
