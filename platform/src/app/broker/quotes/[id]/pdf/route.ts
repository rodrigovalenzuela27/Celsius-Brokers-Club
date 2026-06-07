import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Discount } from "@/lib/quote-engine";
import { QuotePdf, type QuotePdfData } from "./quote-pdf";

export const dynamic = "force-dynamic";

/**
 * PDF de cotización generado server-side (F07).
 * RLS decide el acceso: si la cotización no es del broker (ni admin),
 * la query regresa vacío → 404. Generación on-demand; el upload a
 * Storage llega cuando se conecte Supabase Cloud.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autenticado", { status: 401 });

  const [{ data: quote }, { data: hold }, { data: broker }] = await Promise.all([
    supabase
      .from("quote")
      .select(
        "id, folio, created_at, valid_until, list_price_mxn, discounts, net_price_mxn, down_payment_pct, down_payment_mxn, months, monthly_payment_mxn, balance_at_close_mxn, unit:unit_id(unit_number, m2, bedrooms, bathrooms, floor, project:project_id(name, code)), client:client_id(full_name, email, rfc)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("unit_hold")
      .select("expires_at, released_at")
      .eq("quote_id", id)
      .is("released_at", null)
      .maybeSingle(),
    supabase.from("profile").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  if (!quote) return new Response("Cotización no encontrada", { status: 404 });

  const q = quote as unknown as {
    folio: string;
    created_at: string;
    valid_until: string | null;
    list_price_mxn: number;
    discounts: Discount[];
    net_price_mxn: number;
    down_payment_pct: number;
    down_payment_mxn: number;
    months: number;
    monthly_payment_mxn: number;
    balance_at_close_mxn: number;
    unit: QuotePdfData["unit"];
    client: QuotePdfData["client"];
  };

  const data: QuotePdfData = {
    folio: q.folio,
    createdAt: q.created_at,
    validUntil: q.valid_until,
    holdExpiresAt: hold?.expires_at ?? null,
    client: q.client,
    unit: q.unit,
    brokerName: broker?.full_name || "Broker Celsius",
    listPrice: q.list_price_mxn,
    discounts: q.discounts ?? [],
    netPrice: q.net_price_mxn,
    downPaymentPct: q.down_payment_pct,
    downPayment: q.down_payment_mxn,
    months: q.months,
    monthlyPayment: q.monthly_payment_mxn,
    balanceAtClose: q.balance_at_close_mxn,
  };

  const buffer = await renderToBuffer(
    QuotePdf({ data }) as ReactElement<DocumentProps>,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="celsius-${q.folio}.pdf"`,
    },
  });
}
