import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/format";

type QuoteRow = {
  id: string;
  folio: string;
  status: string;
  net_price_mxn: number;
  created_at: string;
  unit: { unit_number: string; project: { name: string } };
  client: { full_name: string };
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "text-graphite" },
  sent: { label: "Enviada", cls: "text-accent-soft" },
  hold_active: { label: "Apartado 24h", cls: "text-accent" },
  reserved: { label: "Reservada", cls: "text-unit-available" },
  promised: { label: "Promesa firmada", cls: "text-unit-available" },
  won: { label: "Ganada", cls: "text-unit-available" },
  expired: { label: "Expirada", cls: "text-unit-held" },
  cancelled: { label: "Cancelada", cls: "text-graphite" },
};

/** Pipeline de cotizaciones del broker (RLS: solo las suyas). */
export default async function QuotesPage() {
  const supabase = await createClient();

  const { data: quotes } = await supabase
    .from("quote")
    .select(
      "id, folio, status, net_price_mxn, created_at, unit:unit_id(unit_number, project:project_id(name)), client:client_id(full_name)",
    )
    .order("created_at", { ascending: false })
    .returns<QuoteRow[]>();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§ Cotizaciones</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">Mi pipeline</h1>
      <p className="mb-8 text-sm text-graphite">
        Cotizaciones inmutables con snapshot de precio. Los apartados expiran
        solos vía cron en la base de datos.
      </p>

      {quotes?.length ? (
        <table className="w-full border border-hairline text-sm">
          <thead>
            <tr className="bg-deep text-left">
              {["Folio", "Proyecto · unidad", "Cliente", "Precio neto", "Estado", "Creada", ""].map(
                (h) => (
                  <th key={h} scope="col" className="section-mark px-4 py-3 font-normal">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => {
              const st = STATUS_LABEL[q.status] ?? { label: q.status, cls: "" };
              return (
                <tr key={q.id} className="border-t border-hairline hover:bg-deep">
                  <td className="px-4 py-3 font-mono text-xs">{q.folio}</td>
                  <td className="px-4 py-3">
                    {q.unit.project.name} · {q.unit.unit_number}
                  </td>
                  <td className="px-4 py-3 text-graphite">{q.client.full_name}</td>
                  <td className="px-4 py-3">{formatMXN(q.net_price_mxn)}</td>
                  <td className={`px-4 py-3 text-xs uppercase tracking-wider ${st.cls}`}>
                    {st.label}
                  </td>
                  <td className="px-4 py-3 text-graphite">
                    {new Date(q.created_at).toLocaleDateString("es-MX")}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/broker/quotes/${q.id}`} className="text-accent hover:text-accent-hover">
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="border border-hairline bg-deep p-5 text-sm text-graphite">
          Sin cotizaciones aún. Ve al{" "}
          <Link href="/broker" className="text-accent">
            catálogo
          </Link>
          , elige una unidad disponible en el visualizador y genera la primera.
        </p>
      )}
    </div>
  );
}
