// Motor de cálculo del esquema financiero (F06).
// Función pura: se usa en el server action (autoridad final, con precios
// leídos de la DB) y en el wizard como vista previa. El cliente NUNCA
// envía montos — solo unit_id y parámetros del esquema.

export type Discount = { concept: string; pct: number; amount: number };

export type PaymentSchemeInput = {
  downPaymentPct: number; // % de enganche sobre precio neto
  duringWorksPct: number; // % cubierto en mensualidades durante obra
  months: number; // número de mensualidades (0 = sin pagos en obra)
};

export type QuoteComputation = {
  listPrice: number;
  discounts: Discount[];
  netPrice: number;
  downPaymentPct: number;
  downPayment: number;
  months: number;
  monthlyPayment: number;
  balanceAtClose: number;
  paymentSchema: {
    type: "direct_to_works";
    down_payment_pct: number;
    during_works_pct: number;
    months: number;
  };
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeQuote(
  listPrice: number,
  presaleBonusPct: number,
  scheme: PaymentSchemeInput,
): QuoteComputation {
  const discounts: Discount[] = [];
  if (presaleBonusPct > 0) {
    discounts.push({
      concept: `Bono pre-venta (${presaleBonusPct}%)`,
      pct: presaleBonusPct,
      amount: r2((listPrice * presaleBonusPct) / 100),
    });
  }

  const totalDiscount = r2(discounts.reduce((s, d) => s + d.amount, 0));
  const netPrice = r2(listPrice - totalDiscount);
  const downPayment = r2((netPrice * scheme.downPaymentPct) / 100);
  const duringWorks =
    scheme.months > 0 ? r2((netPrice * scheme.duringWorksPct) / 100) : 0;
  const monthlyPayment = scheme.months > 0 ? r2(duringWorks / scheme.months) : 0;
  const balanceAtClose = r2(netPrice - downPayment - duringWorks);

  return {
    listPrice,
    discounts,
    netPrice,
    downPaymentPct: scheme.downPaymentPct,
    downPayment,
    months: scheme.months,
    monthlyPayment,
    balanceAtClose,
    paymentSchema: {
      type: "direct_to_works",
      down_payment_pct: scheme.downPaymentPct,
      during_works_pct: scheme.months > 0 ? scheme.duringWorksPct : 0,
      months: scheme.months,
    },
  };
}
