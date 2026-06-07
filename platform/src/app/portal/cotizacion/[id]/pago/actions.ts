"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { chargeCard } from "@/lib/payments";
import { getQuoteAccess } from "@/lib/portal-session";
import { createClient } from "@/lib/supabase/server";

export type PayState = { error?: string };

const schema = z.object({
  quote_id: z.uuid(),
  card_number: z.string().min(13),
  card_name: z.string().min(3, "Nombre del titular requerido"),
  card_exp: z.string().regex(/^\d{2}\/\d{2}$/, "Vencimiento con formato MM/AA"),
  card_cvc: z.string().regex(/^\d{3,4}$/, "CVC inválido"),
  terms: z.literal("on", { error: "Debes aceptar los términos del apartado" }),
});

/**
 * Cobra el enganche vía el adapter de pagos y confirma la reserva en una
 * transacción (record_payment_and_reserve). El monto NO viene del form:
 * la DB lo recalcula del snapshot de la cotización.
 */
export async function payDownPayment(
  _prev: PayState,
  formData: FormData,
): Promise<PayState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const access = await getQuoteAccess();
  if (!access || access.quoteId !== parsed.data.quote_id) {
    return { error: "Tu acceso expiró. Vuelve a entrar con tu código." };
  }

  const [expMonth, expYear] = parsed.data.card_exp.split("/").map(Number);
  const attempt = await chargeCard({
    number: parsed.data.card_number,
    name: parsed.data.card_name,
    expMonth,
    expYear: 2000 + expYear,
    cvc: parsed.data.card_cvc,
  });

  if (!attempt.ok) return { error: attempt.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_payment_and_reserve", {
    p_quote_id: parsed.data.quote_id,
    p_token: access.token,
    p_provider: attempt.provider,
    p_provider_payment_id: attempt.providerPaymentId,
    p_method: attempt.method,
  });

  if (error) return { error: error.message.replace(/^.*?: /, "") };

  redirect(`/portal/cotizacion/${parsed.data.quote_id}/confirmacion`);
}
