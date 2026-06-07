"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { setQuoteAccess } from "@/lib/portal-session";
import { createClient } from "@/lib/supabase/server";

export type RedeemState = { error?: string };

const schema = z.object({
  email: z.email("Correo inválido"),
  code: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().length(6, "El código tiene 6 dígitos")),
});

export async function redeemCode(
  _prev: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_quote_access_code", {
    p_email: parsed.data.email,
    p_code: parsed.data.code,
  });

  if (error) return { error: error.message.replace(/^.*?: /, "") };

  const result = data as { quote_id: string; token: string };
  await setQuoteAccess(result.quote_id, result.token);
  redirect(`/portal/cotizacion/${result.quote_id}`);
}
