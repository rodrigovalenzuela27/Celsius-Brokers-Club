import { createClient } from "@/lib/supabase/server";
import { toggleCampaign } from "./actions";
import { CampaignForm } from "./campaign-form";

type CampaignRow = {
  id: string;
  title: string;
  body: string;
  format: string;
  audience: string;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
};

const AUDIENCE: Record<string, string> = {
  brokers: "Brokers",
  clients: "Clientes",
  both: "Ambos",
};

/** Campañas (§10 admin): pop-ups y banners dirigidos. */
export default async function CampaignsPage() {
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("campaign")
    .select("id, title, body, format, audience, active, starts_at, ends_at")
    .order("created_at", { ascending: false })
    .returns<CampaignRow[]>();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§10 · Campañas</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">
        Pop-ups & banners
      </h1>
      <p className="mb-8 text-sm text-graphite">
        Los brokers ven sus campañas al entrar a la app; las de clientes
        aparecen como banner en el portal público.
      </p>

      {campaigns?.length ? (
        <table className="mb-8 w-full border border-hairline text-sm">
          <thead>
            <tr className="bg-deep text-left">
              {["Campaña", "Formato", "Audiencia", "Vigencia", "Estado", ""].map((h) => (
                <th key={h} scope="col" className="section-mark px-4 py-3 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-hairline hover:bg-deep">
                <td className="px-4 py-3">
                  {c.title}
                  <div className="max-w-xs truncate text-xs text-graphite">{c.body}</div>
                </td>
                <td className="px-4 py-3 text-graphite">
                  {c.format === "popup" ? "Pop-up" : "Banner"}
                </td>
                <td className="px-4 py-3 text-graphite">{AUDIENCE[c.audience]}</td>
                <td className="px-4 py-3 text-xs text-graphite">
                  {new Date(c.starts_at + "T12:00:00").toLocaleDateString("es-MX")} →{" "}
                  {c.ends_at
                    ? new Date(c.ends_at + "T12:00:00").toLocaleDateString("es-MX")
                    : "∞"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs uppercase tracking-wider ${c.active ? "text-unit-available" : "text-stone"}`}>
                    {c.active ? "Activa" : "Pausada"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form action={toggleCampaign}>
                    <input type="hidden" name="campaign_id" value={c.id} />
                    <input type="hidden" name="active" value={String(!c.active)} />
                    <button className="border border-hairline px-3 py-1.5 text-xs text-graphite hover:border-accent hover:text-accent">
                      {c.active ? "Pausar" : "Activar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <CampaignForm />
    </div>
  );
}
