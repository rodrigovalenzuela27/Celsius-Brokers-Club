import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/format";

type CommissionRow = {
  id: string;
  folio: string;
  status: string;
  base_pct: number;
  tier_bonus_pct: number;
  amount_mxn: number;
  milestone: string;
  earned_at: string | null;
  target_pay_date: string | null;
  paid_at: string | null;
  quote: {
    folio: string;
    client: { full_name: string };
    unit: { unit_number: string; project: { name: string } };
  };
};

const STATUS: Record<string, { label: string; cls: string }> = {
  accruing: { label: "Acumulando", cls: "text-graphite" },
  earned: { label: "Devengada", cls: "text-accent" },
  scheduled: { label: "Programada", cls: "text-accent-soft" },
  paid: { label: "Pagada", cls: "text-unit-available" },
  reversed: { label: "Reversada", cls: "text-red-400" },
  cancelled: { label: "Cancelada", cls: "text-stone" },
};

const MILESTONE: Record<string, string> = {
  reserved: "Pago de enganche",
  promised: "Firma de promesa",
  won: "Escrituración",
};

/** Mis comisiones (§06 del prototipo). RLS: cada broker ve solo las suyas. */
export default async function CommissionsPage() {
  const supabase = await createClient();

  const { data: commissions } = await supabase
    .from("commission")
    .select(
      "id, folio, status, base_pct, tier_bonus_pct, amount_mxn, milestone, earned_at, target_pay_date, paid_at, quote:quote_id(folio, client:client_id(full_name), unit:unit_id(unit_number, project:project_id(name)))",
    )
    .order("created_at", { ascending: false })
    .returns<CommissionRow[]>();

  const rows = commissions ?? [];
  const sum = (statuses: string[]) =>
    rows.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c.amount_mxn, 0);

  const kpis = [
    { label: "Acumulando", value: formatMXN(sum(["accruing"])) },
    { label: "Devengado", value: formatMXN(sum(["earned", "scheduled"])) },
    { label: "Pagado", value: formatMXN(sum(["paid"])) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§06 · Mis comisiones</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">
        Pipeline financiero
      </h1>
      <p className="mb-8 text-sm text-graphite">
        El devengo lo dispara el hito configurado por proyecto; el pago llega
        vía payment run quincenal con retención ISR.
      </p>

      <div className="mb-8 grid grid-cols-3 gap-px border border-hairline bg-hairline">
        {kpis.map((k) => (
          <div key={k.label} className="bg-deep p-5">
            <p className="text-xl tracking-tight">{k.value}</p>
            <p className="section-mark mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {rows.length ? (
        <table className="w-full border border-hairline text-sm">
          <thead>
            <tr className="bg-deep text-left">
              {["Folio", "Cliente · unidad", "Monto", "Hito de devengo", "Pago objetivo", "Estado"].map((h) => (
                <th key={h} scope="col" className="section-mark px-4 py-3 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const st = STATUS[c.status] ?? { label: c.status, cls: "" };
              return (
                <tr key={c.id} className="border-t border-hairline hover:bg-deep">
                  <td className="px-4 py-3 font-mono text-xs">{c.folio}</td>
                  <td className="px-4 py-3">
                    {c.quote.client.full_name} · {c.quote.unit.project.name}{" "}
                    {c.quote.unit.unit_number}
                  </td>
                  <td className="px-4 py-3">
                    {formatMXN(c.amount_mxn)}{" "}
                    <span className="text-xs text-graphite">
                      ({c.base_pct}%
                      {c.tier_bonus_pct > 0 ? (
                        <span className="text-accent"> +{c.tier_bonus_pct}% tier</span>
                      ) : null}
                      )
                    </span>
                  </td>
                  <td className="px-4 py-3 text-graphite">
                    {MILESTONE[c.milestone] ?? c.milestone}
                  </td>
                  <td className="px-4 py-3 text-graphite">
                    {c.paid_at
                      ? `Pagada ${new Date(c.paid_at).toLocaleDateString("es-MX")}`
                      : c.target_pay_date
                        ? new Date(c.target_pay_date).toLocaleDateString("es-MX")
                        : "—"}
                  </td>
                  <td className={`px-4 py-3 text-xs uppercase tracking-wider ${st.cls}`}>
                    {st.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="border border-hairline bg-deep p-5 text-sm text-graphite">
          Sin comisiones aún. Genera cotizaciones: cada una abre una comisión
          en estado «acumulando».
        </p>
      )}
    </div>
  );
}
