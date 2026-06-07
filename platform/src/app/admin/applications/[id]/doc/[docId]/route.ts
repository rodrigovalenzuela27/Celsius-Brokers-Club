import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Descarga de documento de solicitud — solo admin (verificado aquí). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autenticado", { status: 401 });

  const { data: profile } = await supabase
    .from("profile")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return new Response("Prohibido", { status: 403 });

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("application_document")
    .select("filename, mime, content")
    .eq("id", docId)
    .eq("application_id", id)
    .single();

  if (!doc) return new Response("No encontrado", { status: 404 });

  // bytea llega como hex string "\x..."
  const hex = (doc.content as string).replace(/^\\x/, "");
  const bytes = Buffer.from(hex, "hex");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `inline; filename="${doc.filename}"`,
    },
  });
}
