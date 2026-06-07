import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type AuditRow = {
  id: number;
  created_at: string;
  action: string;
  entity: string;
  entity_id: string;
  actor_type: string;
  actor: { email: string } | null;
};

const ENTITIES = [
  "quote",
  "unit_hold",
  "payment",
  "commission",
  "client",
  "unit",
  "project",
  "broker_application",
  "payment_run",
];

const ACTION_CLS: Record<string, string> = {
  INSERT: "text-unit-available",
  UPDATE: "text-accent",
  DELETE: "text-red-400",
};

/** Audit log (§15): registro append-only consultable. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const { entity } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_event")
    .select("id, created_at, action, entity, entity_id, actor_type, actor:actor_id(email)")
    .order("id", { ascending: false })
    .limit(100);
  if (entity) query = query.eq("entity", entity);

  const { data: events } = await query.returns<AuditRow[]>();
  const { count } = await supabase
    .from("audit_event")
    .select("id", { count: "exact", head: true });

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§15 · Audit log</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">
        Registro append-only
      </h1>
      <p className="mb-6 text-sm text-graphite">
        {count ?? 0} eventos en total · escrito por triggers, imposible de
        editar o borrar (también para la aplicación). Mostrando los últimos 100.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/audit"
          className={`border px-3 py-1.5 text-xs ${!entity ? "border-accent text-accent" : "border-hairline text-graphite hover:border-accent"}`}
        >
          Todos
        </Link>
        {ENTITIES.map((e) => (
          <Link
            key={e}
            href={`/admin/audit?entity=${e}`}
            className={`border px-3 py-1.5 text-xs ${entity === e ? "border-accent text-accent" : "border-hairline text-graphite hover:border-accent"}`}
          >
            {e}
          </Link>
        ))}
      </div>

      <table className="w-full border border-hairline text-sm">
        <thead>
          <tr className="bg-deep text-left">
            {["#", "Timestamp", "Acción", "Entidad", "ID", "Actor"].map((h) => (
              <th key={h} scope="col" className="section-mark px-4 py-3 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(events ?? []).map((e) => (
            <tr key={e.id} className="border-t border-hairline hover:bg-deep">
              <td className="px-4 py-2.5 font-mono text-xs text-graphite">{e.id}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-graphite">
                {new Date(e.created_at).toLocaleString("es-MX")}
              </td>
              <td className={`px-4 py-2.5 font-mono text-xs ${ACTION_CLS[e.action] ?? ""}`}>
                {e.action}
              </td>
              <td className="px-4 py-2.5">{e.entity}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-graphite">
                {e.entity_id.slice(0, 8)}…
              </td>
              <td className="px-4 py-2.5 text-xs text-graphite">
                {e.actor?.email ?? `sistema · ${e.actor_type}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
