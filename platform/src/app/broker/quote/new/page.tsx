import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/format";
import { QuoteWizard } from "./wizard";

type UnitDetail = {
  id: string;
  unit_number: string;
  floor: number;
  m2: number;
  bedrooms: number;
  bathrooms: number;
  status: string;
  list_price_mxn: number;
  project: {
    id: string;
    name: string;
    code: string;
    policy_overrides: { presale_bonus_pct?: number };
  };
};

/** Cotizador (F06): paso 1 = unidad elegida (desde el visualizador). */
export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit: unitId } = await searchParams;
  if (!unitId) notFound();

  const supabase = await createClient();

  const [{ data: unit }, { data: clients }] = await Promise.all([
    supabase
      .from("unit")
      .select(
        "id, unit_number, floor, m2, bedrooms, bathrooms, status, list_price_mxn, project:project_id(id, name, code, policy_overrides)",
      )
      .eq("id", unitId)
      .maybeSingle<UnitDetail>(),
    supabase
      .from("client")
      .select("id, full_name, email")
      .order("full_name")
      .returns<{ id: string; full_name: string; email: string }[]>(),
  ]);

  if (!unit) notFound();

  const bonus = unit.project?.policy_overrides?.presale_bonus_pct ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/broker/projects/${unit.project.id}`}
        className="section-mark hover:text-accent"
      >
        ← {unit.project.name}
      </Link>

      <div className="mb-8 mt-4">
        <p className="section-mark mb-2">§04 · Cotizador</p>
        <h1 className="text-2xl font-normal tracking-tight">
          {unit.project.name} · Depto {unit.unit_number}
        </h1>
        <p className="text-sm text-graphite">
          Paso 1 ✓ — {unit.m2} m² · {unit.bedrooms} rec · {unit.bathrooms} baños
          · piso {unit.floor} · {formatMXN(unit.list_price_mxn)}
          {bonus > 0 ? ` · bono pre-venta ${bonus}%` : ""}
        </p>
        {unit.status !== "available" ? (
          <p className="mt-3 border border-unit-held bg-deep p-3 text-sm text-unit-held">
            Esta unidad ya no está disponible (estado actual:{" "}
            {unit.status}). Regresa al visualizador y elige otra.
          </p>
        ) : null}
      </div>

      {unit.status === "available" ? (
        <QuoteWizard
          unitId={unit.id}
          listPrice={unit.list_price_mxn}
          presaleBonusPct={bonus}
          clients={clients ?? []}
        />
      ) : null}
    </div>
  );
}
