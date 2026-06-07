// Adapter de pagos (doc de arquitectura: "cada servicio externo con un
// adapter aislado para poder cambiarlo sin propagación").
//
// Hoy: MockProvider (desarrollo, sin keys). Cuando existan credenciales
// de Stripe, implementar StripeProvider con Payment Intents + 3DS y
// confirmar la reserva desde el webhook (no desde el cliente).

export type CardInput = {
  number: string;
  name: string;
  expMonth: number;
  expYear: number;
  cvc: string;
};

export type PaymentAttempt = {
  provider: "mock" | "stripe";
  providerPaymentId: string;
  method: string; // p. ej. "card •••• 4242"
  ok: boolean;
  error?: string;
};

function luhnValid(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export async function chargeCard(card: CardInput): Promise<PaymentAttempt> {
  if (process.env.STRIPE_SECRET_KEY) {
    // TODO(stripe): PaymentIntent + confirmación 3DS + webhook.
    throw new Error(
      "StripeProvider aún no implementado: retirar MockProvider al conectar keys",
    );
  }

  // ---- MockProvider: valida formato, nunca almacena el PAN ----
  const digits = card.number.replace(/\D/g, "");
  if (!luhnValid(digits)) {
    return {
      provider: "mock",
      providerPaymentId: "",
      method: "",
      ok: false,
      error: "Número de tarjeta inválido",
    };
  }
  const now = new Date();
  const expired =
    card.expYear < now.getFullYear() ||
    (card.expYear === now.getFullYear() && card.expMonth < now.getMonth() + 1);
  if (expired || card.expMonth < 1 || card.expMonth > 12) {
    return {
      provider: "mock",
      providerPaymentId: "",
      method: "",
      ok: false,
      error: "Tarjeta vencida o fecha inválida",
    };
  }
  if (!/^\d{3,4}$/.test(card.cvc)) {
    return {
      provider: "mock",
      providerPaymentId: "",
      method: "",
      ok: false,
      error: "CVC inválido",
    };
  }

  return {
    provider: "mock",
    providerPaymentId: `mock_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`,
    method: `card •••• ${digits.slice(-4)}`,
    ok: true,
  };
}
