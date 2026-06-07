import { getQuoteAccess } from "@/lib/portal-session";
import { createClient } from "@/lib/supabase/server";
import type { Discount } from "@/lib/quote-engine";

export type SharedQuote = {
  id: string;
  folio: string;
  status: string;
  channel: string;
  list_price_mxn: number;
  discounts: Discount[];
  net_price_mxn: number;
  down_payment_pct: number;
  down_payment_mxn: number;
  months: number;
  monthly_payment_mxn: number;
  balance_at_close_mxn: number;
  valid_until: string | null;
  created_at: string;
  client: { full_name: string; email: string };
  unit: {
    unit_number: string;
    floor: number;
    m2: number;
    bedrooms: number;
    bathrooms: number;
  };
  project: { name: string; code: string };
  hold_expires_at: string | null;
  paid: boolean;
};

/**
 * Carga la cotización del cliente del portal validando el token de la
 * cookie contra la DB (get_shared_quote, security definer).
 */
export async function loadSharedQuote(
  quoteId: string,
): Promise<SharedQuote | null> {
  const access = await getQuoteAccess();
  if (!access || access.quoteId !== quoteId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_quote", {
    p_quote_id: quoteId,
    p_token: access.token,
  });
  if (error || !data) return null;
  return data as SharedQuote;
}
