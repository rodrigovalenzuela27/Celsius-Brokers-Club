import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function BrokerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile(["broker_internal", "broker_external"]);

  return (
    <AppShell
      profile={profile}
      area="Cotizador & Pipeline"
      nav={[
        { href: "/broker", label: "Catálogo" },
        { href: "/broker/quotes", label: "Cotizaciones" },
        { href: "/broker/clients", label: "Clientes" },
      ]}
    >
      {children}
    </AppShell>
  );
}
