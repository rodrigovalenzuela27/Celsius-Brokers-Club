import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RedeemButton } from "./redeem-button";

type Tier = {
  slug: string;
  name: string;
  min_points: number;
  commission_bonus_pct: number;
  sort: number;
};
type EventRow = { id: number; points: number; concept: string; created_at: string };
type Item = {
  id: string;
  title: string;
  description: string | null;
  points_cost: number;
  stock: number | null;
  min_tier_slug: string | null;
};
type LeaderRow = { full_name: string; points: number; tier_name: string | null };

/** Celsius Rewards (§10): puntos, tier, catálogo y leaderboard. */
export default async function RewardsPage() {
  const profile = await requireProfile(["broker_internal", "broker_external"]);
  const supabase = await createClient();

  const [tiersQ, eventsQ, itemsQ, leadersQ, totalQ, balanceQ] = await Promise.all([
    supabase.from("reward_tier").select("slug, name, min_points, commission_bonus_pct, sort").order("sort").returns<Tier[]>(),
    supabase.from("reward_event").select("id, points, concept, created_at").order("id", { ascending: false }).limit(15).returns<EventRow[]>(),
    supabase.from("reward_item").select("id, title, description, points_cost, stock, min_tier_slug").eq("active", true).order("points_cost").returns<Item[]>(),
    supabase.rpc("reward_leaderboard").returns<LeaderRow[]>(),
    supabase.rpc("reward_points_total", { p_broker: profile.id }),
    supabase.rpc("reward_balance", { p_broker: profile.id }),
  ]);

  const tiers = tiersQ.data ?? [];
  const leaders = (leadersQ.data ?? []) as LeaderRow[];
  const total = (totalQ.data as number) ?? 0;
  const balance = (balanceQ.data as number) ?? 0;

  const current = [...tiers].reverse().find((t) => t.min_points <= total) ?? tiers[0];
  const next = tiers.find((t) => t.min_points > total);
  const progress = next
    ? Math.round(((total - current.min_points) / (next.min_points - current.min_points)) * 100)
    : 100;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§10 · Celsius Rewards</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">
        {total.toLocaleString("es-MX")} pts · {current?.name}
      </h1>
      <p className="mb-8 text-sm text-graphite">
        Tu tier mejora tu comisión: {current?.commission_bonus_pct ?? 0}% extra
        en cada cotización nueva. Saldo canjeable:{" "}
        {balance.toLocaleString("es-MX")} pts.
      </p>

      <div className="mb-8 border border-hairline bg-deep p-5">
        <div className="mb-3 flex justify-between text-sm">
          {tiers.map((t) => (
            <span
              key={t.slug}
              className={t.slug === current?.slug ? "text-accent" : "text-graphite"}
            >
              {t.name}
              <span className="ml-1 text-xs">
                ({t.min_points.toLocaleString("es-MX")}+ · +{t.commission_bonus_pct}%)
              </span>
            </span>
          ))}
        </div>
        <div className="h-1.5 w-full bg-stone">
          <div className="h-1.5 bg-accent" style={{ width: `${progress}%` }} />
        </div>
        {next ? (
          <p className="mt-2 text-xs text-graphite">
            {(next.min_points - total).toLocaleString("es-MX")} pts para{" "}
            {next.name} (+{next.commission_bonus_pct}% comisión)
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="section-mark mb-3">Catálogo de canje</p>
          <div className="space-y-3">
            {(itemsQ.data ?? []).map((item) => (
              <div key={item.id} className="border border-hairline bg-deep p-4">
                <div className="mb-1 flex items-baseline justify-between">
                  <h3 className="text-sm">{item.title}</h3>
                  <span className="font-mono text-xs text-accent">
                    {item.points_cost.toLocaleString("es-MX")} pts
                  </span>
                </div>
                <p className="mb-3 text-xs text-graphite">
                  {item.description}
                  {item.stock !== null ? ` · ${item.stock} disponibles` : ""}
                  {item.min_tier_slug
                    ? ` · requiere ${tiers.find((t) => t.slug === item.min_tier_slug)?.name}`
                    : ""}
                </p>
                <RedeemButton
                  itemId={item.id}
                  disabled={balance < item.points_cost || item.stock === 0}
                  label={
                    item.stock === 0
                      ? "Agotado"
                      : balance < item.points_cost
                        ? `Te faltan ${(item.points_cost - balance).toLocaleString("es-MX")} pts`
                        : "Canjear →"
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="section-mark mb-3">Leaderboard · trimestre</p>
            <ol className="border border-hairline bg-deep p-4 text-sm">
              {leaders.map((l, i) => (
                <li
                  key={l.full_name + i}
                  className="flex items-center justify-between border-b border-hairline py-2 last:border-0"
                >
                  <span>
                    <span className="mr-2 font-mono text-xs text-accent">#{i + 1}</span>
                    {l.full_name || "—"}
                    <span className="ml-2 text-xs text-graphite">{l.tier_name}</span>
                  </span>
                  <span className="font-mono text-xs">{Number(l.points).toLocaleString("es-MX")}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="section-mark mb-3">Cómo ganas puntos</p>
            <ul className="border border-hairline bg-deep p-4 text-sm text-graphite">
              {[
                ["Cotización emitida", "+10"],
                ["Apartado 24h", "+50"],
                ["Reserva confirmada (enganche)", "+150"],
                ["Venta cerrada (escrituración)", "+500"],
              ].map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-hairline py-1.5 last:border-0">
                  <span>{k}</span>
                  <span className="font-mono text-xs text-accent">{v}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="section-mark mb-3">Últimos movimientos</p>
            <ul className="border border-hairline bg-deep p-4 text-xs text-graphite">
              {(eventsQ.data ?? []).map((e) => (
                <li key={e.id} className="flex justify-between border-b border-hairline py-1.5 last:border-0">
                  <span>{e.concept}</span>
                  <span className="font-mono text-accent">+{e.points}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
