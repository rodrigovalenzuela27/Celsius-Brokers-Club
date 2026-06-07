import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DecisionButtons } from "./decision-buttons";

type AppDetail = {
  id: string;
  folio: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  experience: string | null;
  specialty: string | null;
  brokerage_name: string | null;
  motivation: string | null;
  status: string;
  review_notes: string | null;
  decided_at: string | null;
  created_at: string;
};

type Doc = { id: string; doc_type: string; filename: string; mime: string; size_bytes: number };

const DOC_LABEL: Record<string, string> = {
  ine: "INE / pasaporte",
  rfc: "Constancia fiscal",
  domicilio: "Comprobante de domicilio",
  bancaria: "Carátula bancaria",
  cedula: "Cédula profesional",
};

export default async function ApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: app }, { data: docs }] = await Promise.all([
    supabase
      .from("broker_application")
      .select(
        "id, folio, full_name, email, phone, city, experience, specialty, brokerage_name, motivation, status, review_notes, decided_at, created_at",
      )
      .eq("id", id)
      .maybeSingle<AppDetail>(),
    supabase
      .from("application_document")
      .select("id, doc_type, filename, mime, size_bytes")
      .eq("application_id", id)
      .returns<Doc[]>(),
  ]);

  if (!app) notFound();

  const decidable = ["pending", "in_review", "needs_docs"].includes(app.status);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/applications" className="section-mark hover:text-accent">
        ← Solicitudes
      </Link>

      <div className="mb-6 mt-4">
        <p className="section-mark mb-2">
          {app.folio} · recibida {new Date(app.created_at).toLocaleString("es-MX")}
        </p>
        <h1 className="text-2xl font-normal tracking-tight">{app.full_name}</h1>
        <p className="text-sm text-graphite">
          {app.email} · {app.phone ?? "—"} · {app.city ?? "—"}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="border border-hairline bg-deep p-5">
          <p className="section-mark mb-4">Perfil profesional</p>
          <dl className="space-y-2 text-sm">
            {[
              ["Experiencia", `${app.experience ?? "—"} años`],
              ["Especialidad", app.specialty ?? "—"],
              ["Inmobiliaria", app.brokerage_name ?? "Independiente"],
              ["Comisión propuesta", "2.5% (externo)"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-hairline pb-1.5">
                <dt className="text-graphite">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {app.motivation ? (
            <p className="mt-4 border-t border-hairline pt-3 text-sm text-graphite">
              “{app.motivation}”
            </p>
          ) : null}
        </div>

        <div className="border border-hairline bg-deep p-5">
          <p className="section-mark mb-4">
            Documentos · {docs?.length ?? 0}/4
          </p>
          <ul className="space-y-2 text-sm">
            {(docs ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between border-b border-hairline pb-2">
                <span className="text-graphite">
                  {DOC_LABEL[d.doc_type] ?? d.doc_type}
                  <span className="ml-2 text-xs">
                    ({Math.round(d.size_bytes / 1024)} KB)
                  </span>
                </span>
                <a
                  href={`/admin/applications/${app.id}/doc/${d.id}`}
                  target="_blank"
                  className="text-accent hover:text-accent-hover"
                >
                  Ver →
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border border-hairline bg-deep p-5">
        <p className="section-mark mb-4">Decisión</p>
        {decidable ? (
          <DecisionButtons applicationId={app.id} />
        ) : (
          <p className="text-sm text-graphite">
            {app.status === "approved" ? "✓ Aprobada" : "✕ Rechazada"}
            {app.decided_at
              ? ` el ${new Date(app.decided_at).toLocaleString("es-MX")}`
              : ""}
            {app.review_notes ? ` · "${app.review_notes}"` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
