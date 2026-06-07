import Link from "next/link";
import {
  CampaignBanner,
  type CampaignData,
} from "@/components/campaign-display";
import { createClient } from "@/lib/supabase/server";

/** Shell del portal público: top-nav como el prototipo, sin sesión. */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Campañas para clientes (RLS anon: solo activas y vigentes).
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaign")
    .select("id, title, body, cta_label, cta_href, format")
    .eq("format", "banner")
    .limit(1)
    .returns<CampaignData[]>();
  const banner = campaigns?.[0];

  return (
    <div className="flex min-h-screen flex-col">
      {banner ? <CampaignBanner campaign={banner} /> : null}
      <header className="flex items-center justify-between border-b border-hairline bg-deep px-6 py-4">
        <Link href="/portal" className="text-lg tracking-wide">
          Celsius
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/portal/proyectos" className="text-graphite hover:text-accent">
            Proyectos
          </Link>
          <Link href="/portal/codigo" className="text-graphite hover:text-accent">
            Tengo un código
          </Link>
          <Link
            href="/login"
            className="border border-hairline px-3 py-1.5 text-xs text-graphite hover:border-accent hover:text-accent"
          >
            Soy broker
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-hairline bg-deep px-6 py-4">
        <p className="section-mark">
          Celsius · plataforma de venta directa · los datos personales se
          tratan conforme al aviso de privacidad (LFPDPPP)
        </p>
      </footer>
    </div>
  );
}
