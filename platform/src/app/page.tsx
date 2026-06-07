import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, type Profile } from "@/lib/auth";

/**
 * Raíz: sin sesión (o rol client) → portal público.
 * Brokers y admin → su área de trabajo.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/portal");

  const { data: profile } = await supabase
    .from("profile")
    .select("role")
    .eq("id", user.id)
    .single<Pick<Profile, "role">>();

  if (!profile || profile.role === "client") redirect("/portal");
  redirect(homeForRole(profile.role));
}
