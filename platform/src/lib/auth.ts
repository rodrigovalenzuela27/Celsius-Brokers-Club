import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "broker_internal" | "broker_external" | "client";

export type Profile = {
  id: string;
  developer_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  brokerage_id: string | null;
  active: boolean;
};

/** Home de cada rol después de autenticarse. */
export function homeForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "broker_internal":
    case "broker_external":
      return "/broker";
    case "client":
      return "/"; // portal cliente llega en fase 3
  }
}

/**
 * Obtiene el perfil del usuario autenticado o redirige a /login.
 * Si se pasa `allowed`, además exige uno de esos roles.
 */
export async function requireProfile(allowed?: UserRole[]): Promise<Profile> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profile")
    .select(
      "id, developer_id, role, full_name, email, phone, brokerage_id, active",
    )
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !profile.active) redirect("/login");

  if (allowed && !allowed.includes(profile.role)) {
    redirect(homeForRole(profile.role));
  }

  return profile;
}
