import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, type Profile } from "@/lib/auth";

/**
 * Raíz: despacha por rol. Sin sesión → /login.
 * El portal público del cliente llega en fase 3; mientras tanto un
 * usuario con rol client ve una pantalla informativa.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profile")
    .select("role")
    .eq("id", user.id)
    .single<Pick<Profile, "role">>();

  if (!profile) redirect("/login");
  if (profile.role !== "client") redirect(homeForRole(profile.role));

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md border border-hairline bg-deep p-8 text-center">
        <p className="section-mark mb-4">§ Portal cliente</p>
        <h1 className="mb-3 text-xl">Próximamente</h1>
        <p className="text-sm text-graphite">
          El portal de clientes (catálogo público, cotización directa y pago de
          enganche) se habilita en la fase 3 del roadmap.
        </p>
      </div>
    </main>
  );
}
