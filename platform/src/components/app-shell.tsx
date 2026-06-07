import Link from "next/link";
import type { Profile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const ROLE_LABEL: Record<Profile["role"], string> = {
  admin: "Administración",
  broker_internal: "Broker · interno",
  broker_external: "Broker · externo",
  client: "Cliente",
};

export type NavItem = { href: string; label: string };

/** Shell de la app: topbar con identidad, navegación del área, rol y logout. */
export function AppShell({
  profile,
  area,
  nav = [],
  children,
}: {
  profile: Profile;
  area: string;
  nav?: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-hairline bg-deep px-6 py-3.5">
        <div className="flex items-baseline gap-6">
          <span className="text-lg tracking-wide">Celsius</span>
          <span className="section-mark">{area}</span>
          <nav className="flex gap-4">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-graphite transition-colors hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="section-mark">
            {profile.full_name || profile.email} · {ROLE_LABEL[profile.role]}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="border border-hairline px-3 py-1.5 text-xs text-graphite transition-colors hover:border-accent hover:text-accent"
            >
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
