import { AppShell } from "@/components/app-shell";
import {
  CampaignBanner,
  CampaignPopup,
  type CampaignData,
} from "@/components/campaign-display";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function BrokerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile(["broker_internal", "broker_external"]);

  // Campañas activas para brokers (RLS filtra audiencia y vigencia).
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaign")
    .select("id, title, body, cta_label, cta_href, format")
    .order("created_at", { ascending: false })
    .returns<CampaignData[]>();

  const popup = campaigns?.find((c) => c.format === "popup");
  const banner = campaigns?.find((c) => c.format === "banner");

  return (
    <AppShell
      profile={profile}
      area="Cotizador & Pipeline"
      nav={[
        { href: "/broker", label: "Catálogo" },
        { href: "/broker/quotes", label: "Cotizaciones" },
        { href: "/broker/clients", label: "Clientes" },
        { href: "/broker/commissions", label: "Mis comisiones" },
        { href: "/broker/rewards", label: "Rewards" },
        { href: "/broker/showroom", label: "Showroom" },
        { href: "/broker/community", label: "Comunidad" },
      ]}
    >
      {banner ? <CampaignBanner campaign={banner} /> : null}
      {popup ? <CampaignPopup campaign={popup} /> : null}
      {children}
    </AppShell>
  );
}
