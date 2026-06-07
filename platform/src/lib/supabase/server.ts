import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente Supabase para Server Components, Server Actions y Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll desde un Server Component: ignorable si el proxy
            // refresca la sesión.
          }
        },
      },
    },
  );
}
