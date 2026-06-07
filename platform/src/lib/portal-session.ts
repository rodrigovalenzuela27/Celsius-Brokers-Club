import { cookies } from "next/headers";

// Acceso del cliente sin cuenta: cookie httpOnly con quote_id + token
// emitido por la DB (redeem_quote_access_code / create_direct_quote).
const COOKIE = "celsius_quote_access";

export async function setQuoteAccess(quoteId: string, token: string) {
  const store = await cookies();
  store.set(COOKIE, `${quoteId}:${token}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/portal",
    maxAge: 60 * 60 * 24, // 24 h, igual que el token en DB
  });
}

export async function getQuoteAccess(): Promise<{
  quoteId: string;
  token: string;
} | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const [quoteId, token] = raw.split(":");
  if (!quoteId || !token) return null;
  return { quoteId, token };
}
