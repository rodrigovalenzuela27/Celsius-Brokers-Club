import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile(["admin"]);

  return (
    <AppShell
      profile={profile}
      area="Consola operativa"
      nav={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/inventory", label: "Inventario" },
        { href: "/admin/commissions", label: "Comisiones" },
      ]}
    >
      {children}
    </AppShell>
  );
}
