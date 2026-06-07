import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard admin · fase 0.
 * KPIs reales calculados contra la base de datos (no hardcodeados,
 * a diferencia del prototipo).
 */
export default async function AdminDashboard() {
  const supabase = await createClient();

  const [projects, units, available, brokers] = await Promise.all([
    supabase.from("project").select("id", { count: "exact", head: true }),
    supabase.from("unit").select("id", { count: "exact", head: true }),
    supabase
      .from("unit")
      .select("id", { count: "exact", head: true })
      .eq("status", "available"),
    supabase
      .from("profile")
      .select("id", { count: "exact", head: true })
      .in("role", ["broker_internal", "broker_external"]),
  ]);

  const kpis = [
    { label: "Proyectos", value: projects.count ?? 0 },
    { label: "Unidades totales", value: units.count ?? 0 },
    { label: "Disponibles", value: available.count ?? 0 },
    { label: "Brokers activos", value: brokers.count ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§01 · Dashboard ejecutivo</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">Operación</h1>
      <p className="mb-8 text-sm text-graphite">
        Datos en vivo desde Postgres. Inventario, políticas y comisiones se
        habilitan en las fases 1–4.
      </p>

      <div className="grid grid-cols-2 gap-px border border-hairline bg-hairline sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-deep p-6">
            <p className="text-3xl font-normal tracking-tight">{k.value}</p>
            <p className="section-mark mt-2">{k.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
