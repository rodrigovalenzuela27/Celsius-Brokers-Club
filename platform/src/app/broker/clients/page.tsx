import { createClient } from "@/lib/supabase/server";
import { NewClientForm } from "./client-form";

type ClientRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  rfc: string | null;
  consent_version: string | null;
  created_at: string;
};

/** Cartera del broker (F09). RLS: cada broker ve solo SUS clientes. */
export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("client")
    .select("id, full_name, email, phone, rfc, consent_version, created_at")
    .order("created_at", { ascending: false })
    .returns<ClientRow[]>();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§05 · Clientes</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">Mi cartera</h1>
      <p className="mb-8 text-sm text-graphite">
        Solo ves tus propios clientes (RLS). El alta registra el consentimiento
        LFPDPPP. La sincronización a HubSpot llega en fase 4.
      </p>

      {clients?.length ? (
        <table className="mb-8 w-full border border-hairline text-sm">
          <thead>
            <tr className="bg-deep text-left">
              {["Cliente", "Correo", "Teléfono", "RFC", "Consentimiento", "Alta"].map((h) => (
                <th key={h} scope="col" className="section-mark px-4 py-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-hairline hover:bg-deep">
                <td className="px-4 py-3">{c.full_name}</td>
                <td className="px-4 py-3 text-graphite">{c.email}</td>
                <td className="px-4 py-3 text-graphite">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.rfc ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-unit-available">
                  {c.consent_version ? `✓ ${c.consent_version}` : "—"}
                </td>
                <td className="px-4 py-3 text-graphite">
                  {new Date(c.created_at).toLocaleDateString("es-MX")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mb-8 border border-hairline bg-deep p-5 text-sm text-graphite">
          Aún no tienes clientes. Da de alta el primero abajo.
        </p>
      )}

      <NewClientForm />
    </div>
  );
}
