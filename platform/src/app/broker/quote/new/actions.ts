"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { computeQuote } from "@/lib/quote-engine";
import { createClient } from "@/lib/supabase/server";

export type QuoteActionState = { error?: string };

const quoteSchema = z
  .object({
    unit_id: z.uuid(),
    client_id: z.uuid("Selecciona un cliente"),
    down_payment_pct: z.coerce.number().min(10).max(90),
    during_works_pct: z.coerce.number().min(0).max(60),
    months: z.coerce.number().int().min(0).max(36),
  })
  .refine((d) => d.down_payment_pct + d.during_works_pct <= 95, {
    message: "Enganche + pagos en obra no pueden exceder 95% del precio",
  });

/**
 * Genera cotización + apartado 24h (F06–F08).
 * El cliente solo envía unit_id y parámetros del esquema; los montos se
 * calculan AQUÍ con el precio leído de la DB, y la transacción atómica
 * (hold + quote + unidad) ocurre en create_quote_with_hold().
 */
export async function createQuote(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  await requireProfile(["broker_internal", "broker_external"]);

  const parsed = quoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("unit")
    .select("id, list_price_mxn, project:project_id(policy_overrides)")
    .eq("id", parsed.data.unit_id)
    .maybeSingle<{
      id: string;
      list_price_mxn: number;
      project: { policy_overrides: { presale_bonus_pct?: number } };
    }>();

  if (!unit) return { error: "Unidad no encontrada o sin acceso." };

  const calc = computeQuote(
    unit.list_price_mxn,
    unit.project?.policy_overrides?.presale_bonus_pct ?? 0,
    {
      downPaymentPct: parsed.data.down_payment_pct,
      duringWorksPct: parsed.data.during_works_pct,
      months: parsed.data.months,
    },
  );

  const { data: quoteId, error } = await supabase.rpc("create_quote_with_hold", {
    p_unit_id: parsed.data.unit_id,
    p_client_id: parsed.data.client_id,
    p_list_price_mxn: calc.listPrice,
    p_discounts: calc.discounts,
    p_net_price_mxn: calc.netPrice,
    p_down_payment_pct: calc.downPaymentPct,
    p_down_payment_mxn: calc.downPayment,
    p_months: calc.months,
    p_monthly_payment_mxn: calc.monthlyPayment,
    p_balance_at_close_mxn: calc.balanceAtClose,
    p_payment_schema: calc.paymentSchema,
  });

  if (error) {
    // Mensajes de negocio de la función SQL (unidad tomada, precio cambió…)
    return { error: error.message.replace(/^.*?: /, "") };
  }

  redirect(`/broker/quotes/${quoteId}`);
}
