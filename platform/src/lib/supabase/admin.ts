import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con SERVICE ROLE — bypassa RLS. SOLO para server actions /
 * route handlers que validan todo antes de tocar la DB (alta de
 * solicitudes desde el portal anónimo, aprobación de brokers).
 * Jamás importar desde código de cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
