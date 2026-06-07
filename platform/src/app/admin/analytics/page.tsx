import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/format";

type QuoteAgg = {
  status: string;
  net_price_mxn: number;
  channel: string;
  created_at: string;
  broker: { full_name: string; email: string } | null;
};

const CLOSED = ["reserved", "promised", "won"];

/** Analytics (§16 broker / F15): KPIs comerciales desde datos reales. */
export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: quotes } = await supabase
    .from("quote")
    .select("status, net_price_mxn, channel, created_at, broker:broker_id(full_name, email)")
    .returns<QuoteAgg[]>();

  const rows = quotes ?? [];
  const closed = rows.filter((q) => CLOSED.includes(q.status));
  const conversion = rows.length ? Math.round((closed.length / rows.length) * 100) : 0;
  const ticket = closed.length
    ? closed.reduce((s, q) => s + q.net_price_mxn, 0) / closed.length
    : 0;
  const directShare = rows.length
    ? Math.round((rows.filter((q) => q.channel === "direct").length / rows.length) * 100)
    : 0;

  // Top brokers por reservas
  const byBroker = new Map<string, { name: string; closed: number; volume: number }>();
  for (const q of closed) {
    if (!q.broker) continue;
    const key = q.broker.email;
    const cur = byBroker.get(key) ?? {
      name: q.broker.full_name || q.broker.email,
      closed: 0,
      volume: 0,
    };
    cur.closed += 1;
    cur.volume += q.net_price_mxn;
    byBroker.set(key, cur);
  }
  const top = [...byBroker.values()].sort((a, b) => b.volume - a.volume).slice(0, 10);

  // Cotizaciones por mes
  const byMonth = new Map<string, number>();
  for (const q of rows) {
    const m = q.created_at.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  const months = [...byMonth.entries()].sort();
  const maxMonth = Math.max(1, ...months.map(([, n]) => n));

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§ Analytics</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">
        Performance comercial
      </h1>
      <p className="mb-8 text-sm text-graphite">
        Calculado en vivo sobre las cotizaciones reales — nada hardcodeado.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-px border border-hairline bg-hairline sm:grid-cols-4">
        {[
          { label: "Cotizaciones", value: String(rows.length) },
          { label: "Conversión a reserva", value: `${conversion}%` },
          { label: "Ticket promedio", value: ticket ? formatMXN(ticket) : "—" },
          { label: "Canal directo", value: `${directShare}%` },
        ].map((k) => (
          <div key={k.label} className="bg-deep p-5">
            <p className="text-xl tracking-tight">{k.value}</p>
            <p className="section-mark mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="border border-hairline bg-deep p-5">
          <p className="section-mark mb-4">Cotizaciones por mes</p>
          {months.length ? (
            <div className="space-y-2">
              {months.map(([m, n]) => (
                <div key={m} className="flex items-center gap-3 text-sm">
                  <span className="w-16 font-mono text-xs text-graphite">{m}</span>
                  <div className="h-4 bg-accent" style={{ width: `${(n / maxMonth) * 70}%` }} />
                  <span className="text-xs text-graphite">{n}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-graphite">Sin datos.</p>
          )}
        </div>

        <div className="border border-hairline bg-deep p-5">
          <p className="section-mark mb-4">Top brokers · por volumen reservado</p>
          {top.length ? (
            <ol className="space-y-2 text-sm">
              {top.map((b, i) => (
                <li key={b.name} className="flex items-center justify-between border-b border-hairline pb-2">
                  <span>
                    <span className="mr-2 font-mono text-xs text-accent">#{i + 1}</span>
                    {b.name}
                  </span>
                  <span className="text-graphite">
                    {b.closed} · {formatMXN(b.volume)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-graphite">Aún sin reservas con broker.</p>
          )}
        </div>
      </div>
    </div>
  );
}
