"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { computeQuote } from "@/lib/quote-engine";
import { setQuoteAccess } from "@/lib/portal-session";
import { createClient } from "@/lib/supabase/server";

export type DirectQuoteState = { error?: string };

const schema = z
  .object({
    unit_id: z.uuid(),
    full_name: z.string().min(3, "Nombre completo requerido"),
    email: z.email("Correo inválido"),
    phone: z.string().regex(/^\+?[\d\s-]{10,15}$/, "Teléfono inválido").optional().or(z.literal("")),
    rfc: z.string().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i, "RFC inválido").optional().or(z.literal("")),
    consent: z.literal("on", { error: "Debes aceptar el aviso de privacidad" }),
    down_payment_pct: z.coerce.number().min(10).max(90),
    during_works_pct: z.coerce.number().min(0).max(60),
    months: z.coerce.number().int().min(0).max(36),
  })
  .refine((d) => d.down_payment_pct + d.during_works_pct <= 95, {
    message: "Enganche + pagos en obra no pueden exceder 95%",
  });

/** Compra directa: cotiza + aparta sin cuenta (bono +1%). */
export async function createDirectQuote(
  _prev: DirectQuoteState,
  formData: FormData,
): Promise<DirectQuoteState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("unit")
    .select("id, list_price_mxn, project:project_id(policy_overrides)")
    .eq("id", parsed.data.unit_id)
    .maybeSingle<{
      id: string;
      list_price_mxn: number;
      project: {
        policy_overrides: {
          presale_bonus_pct?: number;
          direct_purchase_bonus_pct?: number;
        };
      };
    }>();

  if (!unit) return { error: "Unidad no encontrada." };

  const overrides = unit.project?.policy_overrides ?? {};
  const calc = computeQuote(
    unit.list_price_mxn,
    overrides.presale_bonus_pct ?? 0,
    {
      downPaymentPct: parsed.data.down_payment_pct,
      duringWorksPct: parsed.data.during_works_pct,
      months: parsed.data.months,
    },
    overrides.direct_purchase_bonus_pct ?? 1, // bono "sé tu propio broker"
  );

  const { data, error } = await supabase.rpc("create_direct_quote", {
    p_unit_id: parsed.data.unit_id,
    p_full_name: parsed.data.full_name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone ?? "",
    p_rfc: parsed.data.rfc ?? "",
    p_consent: true,
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

  if (error) return { error: error.message.replace(/^.*?: /, "") };

  const result = data as { quote_id: string; token: string };
  await setQuoteAccess(result.quote_id, result.token);
  redirect(`/portal/cotizacion/${result.quote_id}`);
}
