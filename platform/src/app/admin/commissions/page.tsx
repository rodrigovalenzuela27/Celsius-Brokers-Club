import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/format";
import { approveRun, processRun } from "./actions";
import { CreateRunForm } from "./run-form";

type CommissionRow = {
  id: string;
  folio: string;
  status: string;
  amount_mxn: number;
  milestone: string;
  earned_at: string | null;
  target_pay_date: string | null;
  broker: { full_name: string; email: string };
  quote: { folio: string; unit: { unit_number: string; project: { name: string } } };
};

type RunRow = {
  id: string;
  run_date: string;
  status: string;
  gross_mxn: number;
  isr_mxn: number;
  net_mxn: number;
};

const STATUS_LABEL: Record<string, string> = {
  accruing: "Acumulando",
  earned: "Devengada",
  scheduled: "Programada",
  paid: "Pagada",
  reversed: "Reversada",
  cancelled: "Cancelada",
};

function agingDays(earnedAt: string | null): number {
  if (!earnedAt) return 0;
  return Math.floor((Date.now() - new Date(earnedAt).getTime()) / 86_400_000);
}

/** Comisiones · pasivos & pagos (§13 del prototipo). */
export default async function AdminCommissionsPage() {
  const supabase = await createClient();

  const [{ data: commissions }, { data: runs }] = await Promise.all([
    supabase
      .from("commission")
      .select(
        "id, folio, status, amount_mxn, milestone, earned_at, target_pay_date, broker:broker_id(full_name, email), quote:quote_id(folio, unit:unit_id(unit_number, project:project_id(name)))",
      )
      .order("created_at", { ascending: false })
      .returns<CommissionRow[]>(),
    supabase
      .from("payment_run")
      .select("id, run_date, status, gross_mxn, isr_mxn, net_mxn")
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<RunRow[]>(),
  ]);

  const rows = commissions ?? [];
  const liability = rows.filter((c) => ["earned", "scheduled"].includes(c.status));
  const sum = (cs: CommissionRow[]) => cs.reduce((s, c) => s + c.amount_mxn, 0);

  const buckets = [
    { label: "0–15d", test: (d: number) => d <= 15 },
    { label: "15–30d", test: (d: number) => d > 15 && d <= 30 },
    { label: "30–45d", test: (d: number) => d > 30 && d <= 45 },
    { label: "45+d · revisar", test: (d: number) => d > 45 },
  ];

  // Server component: se evalúa por request, no re-renderiza en cliente.
  // eslint-disable-next-line react-hooks/purity
  const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="section-mark mb-2">§13 · Comisiones · pasivos & pagos</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">
        Control financiero del devengo
      </h1>
      <p className="mb-8 text-sm text-graphite">
        Devengo automático por hito de proyecto · reverso dentro de la ventana
        de retención (90d) · payment runs con retención ISR 10%.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-px border border-hairline bg-hairline sm:grid-cols-4">
        {[
          { label: "Pasivo vigente", value: formatMXN(sum(liability)) },
          {
            label: "Comisiones en pasivo",
            value: String(liability.length),
          },
          {
            label: "Pagado",
            value: formatMXN(sum(rows.filter((c) => c.status === "paid"))),
          },
          {
            label: "Reversadas",
            value: formatMXN(sum(rows.filter((c) => c.status === "reversed"))),
          },
        ].map((k) => (
          <div key={k.label} className="bg-deep p-5">
            <p className="text-xl tracking-tight">{k.value}</p>
            <p className="section-mark mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <p className="section-mark mb-3">Aging del pasivo</p>
      <div className="mb-8 grid grid-cols-4 gap-px border border-hairline bg-hairline">
        {buckets.map((b) => {
          const cs = liability.filter((c) => b.test(agingDays(c.earned_at)));
          return (
            <div key={b.label} className="bg-deep p-4">
              <p className="text-lg">{formatMXN(sum(cs))}</p>
              <p className="section-mark mt-1">
                {b.label} · {cs.length}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mb-8 border border-hairline bg-deep p-5">
        <p className="section-mark mb-4">Nuevo payment run</p>
        <CreateRunForm defaultDate={inAWeek} />
        <p className="mt-3 text-xs text-graphite">
          Incluye toda comisión devengada con pago objetivo ≤ fecha del run.
          Flujo: borrador → aprobar → procesar (dispersión SPEI al integrar
          proveedor).
        </p>
      </div>

      {runs?.length ? (
        <>
          <p className="section-mark mb-3">Payment runs</p>
          <table className="mb-8 w-full border border-hairline text-sm">
            <thead>
              <tr className="bg-deep text-left">
                {["Fecha", "Bruto", "ISR 10%", "Neto a dispersar", "Estado", ""].map((h) => (
                  <th key={h} scope="col" className="section-mark px-4 py-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-hairline">
                  <td className="px-4 py-3">{new Date(r.run_date + "T12:00:00").toLocaleDateString("es-MX")}</td>
                  <td className="px-4 py-3">{formatMXN(r.gross_mxn)}</td>
                  <td className="px-4 py-3 text-graphite">−{formatMXN(r.isr_mxn)}</td>
                  <td className="px-4 py-3">{formatMXN(r.net_mxn)}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wider text-accent">
                    {r.status === "draft" ? "Borrador" : r.status === "approved" ? "Aprobado" : "Procesado"}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "draft" ? (
                      <form action={approveRun} className="inline">
                        <input type="hidden" name="run_id" value={r.id} />
                        <button className="border border-accent px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-deep">
                          Aprobar
                        </button>
                      </form>
                    ) : r.status === "approved" ? (
                      <form action={processRun} className="inline">
                        <input type="hidden" name="run_id" value={r.id} />
                        <button className="bg-accent px-3 py-1.5 text-xs font-medium text-deep hover:bg-accent-hover">
                          Procesar pagos
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-unit-available">✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <p className="section-mark mb-3">Todas las comisiones</p>
      <table className="w-full border border-hairline text-sm">
        <thead>
          <tr className="bg-deep text-left">
            {["Folio", "Broker", "Cliente · unidad", "Monto", "Aging", "Pago objetivo", "Estado"].map((h) => (
              <th key={h} scope="col" className="section-mark px-4 py-3 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const days = agingDays(c.earned_at);
            return (
              <tr key={c.id} className="border-t border-hairline hover:bg-deep">
                <td className="px-4 py-3 font-mono text-xs">{c.folio}</td>
                <td className="px-4 py-3">{c.broker.full_name || c.broker.email}</td>
                <td className="px-4 py-3 text-graphite">
                  {c.quote.unit.project.name} {c.quote.unit.unit_number}
                </td>
                <td className="px-4 py-3">{formatMXN(c.amount_mxn)}</td>
                <td className={`px-4 py-3 ${days > 45 ? "text-red-400" : "text-graphite"}`}>
                  {c.earned_at ? `${days}d` : "—"}
                </td>
                <td className="px-4 py-3 text-graphite">
                  {c.target_pay_date
                    ? new Date(c.target_pay_date + "T12:00:00").toLocaleDateString("es-MX")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-xs uppercase tracking-wider">
                  {STATUS_LABEL[c.status] ?? c.status}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
