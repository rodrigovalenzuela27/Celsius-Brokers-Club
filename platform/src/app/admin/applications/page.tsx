import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type AppRow = {
  id: string;
  folio: string;
  full_name: string;
  email: string;
  city: string | null;
  experience: string | null;
  brokerage_name: string | null;
  status: string;
  created_at: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "text-accent" },
  in_review: { label: "En revisión", cls: "text-accent-soft" },
  needs_docs: { label: "Faltan docs", cls: "text-unit-held" },
  approved: { label: "Aprobada", cls: "text-unit-available" },
  rejected: { label: "Rechazada", cls: "text-stone" },
};

/** Solicitudes de broker (§14): queue de revisión. */
export default async function ApplicationsPage() {
  const supabase = await createClient();

  const { data: apps } = await supabase
    .from("broker_application")
    .select("id, folio, full_name, email, city, experience, brokerage_name, status, created_at")
    .order("created_at", { ascending: false })
    .returns<AppRow[]>();

  const rows = apps ?? [];
  const open = rows.filter((a) =>
    ["pending", "in_review", "needs_docs"].includes(a.status),
  ).length;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§14 · Solicitudes de broker</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">
        Queue de revisión
      </h1>
      <p className="mb-8 text-sm text-graphite">
        {open} abiertas de {rows.length}. SLA de respuesta: 3 días hábiles.
        Aprobar crea la cuenta broker_external con su inmobiliaria.
      </p>

      {rows.length ? (
        <table className="w-full border border-hairline text-sm">
          <thead>
            <tr className="bg-deep text-left">
              {["Folio", "Aspirante", "Ciudad", "Experiencia", "Inmobiliaria", "Recibida", "Estado", ""].map((h) => (
                <th key={h} scope="col" className="section-mark px-4 py-3 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const st = STATUS[a.status] ?? { label: a.status, cls: "" };
              return (
                <tr key={a.id} className="border-t border-hairline hover:bg-deep">
                  <td className="px-4 py-3 font-mono text-xs">{a.folio}</td>
                  <td className="px-4 py-3">
                    {a.full_name}
                    <div className="text-xs text-graphite">{a.email}</div>
                  </td>
                  <td className="px-4 py-3 text-graphite">{a.city ?? "—"}</td>
                  <td className="px-4 py-3 text-graphite">{a.experience ?? "—"} años</td>
                  <td className="px-4 py-3 text-graphite">{a.brokerage_name ?? "Independiente"}</td>
                  <td className="px-4 py-3 text-graphite">
                    {new Date(a.created_at).toLocaleDateString("es-MX")}
                  </td>
                  <td className={`px-4 py-3 text-xs uppercase tracking-wider ${st.cls}`}>
                    {st.label}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/applications/${a.id}`} className="text-accent hover:text-accent-hover">
                      Revisar →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="border border-hairline bg-deep p-5 text-sm text-graphite">
          Sin solicitudes. Llegan desde el portal público (Ruta C · Quiero ser
          broker).
        </p>
      )}
    </div>
  );
}
