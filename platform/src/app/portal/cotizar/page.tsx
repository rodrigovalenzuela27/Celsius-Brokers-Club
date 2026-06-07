import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/format";
import { DirectWizard } from "./direct-wizard";

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
    policy_overrides: {
      presale_bonus_pct?: number;
      direct_purchase_bonus_pct?: number;
    };
  };
};

export default async function DirectQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit: unitId } = await searchParams;
  if (!unitId) notFound();

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("unit")
    .select(
      "id, unit_number, floor, m2, bedrooms, bathrooms, status, list_price_mxn, project:project_id(id, name, policy_overrides)",
    )
    .eq("id", unitId)
    .maybeSingle<UnitDetail>();

  if (!unit) notFound();

  const ov = unit.project?.policy_overrides ?? {};
  const presale = ov.presale_bonus_pct ?? 0;
  const direct = ov.direct_purchase_bonus_pct ?? 1;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href={`/portal/proyectos/${unit.project.id}`}
        className="section-mark hover:text-accent"
      >
        ← {unit.project.name}
      </Link>

      <div className="mb-8 mt-4">
        <p className="section-mark mb-2">§ Compra directa · paso 1 ✓</p>
        <h1 className="text-2xl font-normal tracking-tight">
          {unit.project.name} · Depto {unit.unit_number}
        </h1>
        <p className="text-sm text-graphite">
          {unit.m2} m² · {unit.bedrooms} rec · {unit.bathrooms} baños · piso{" "}
          {unit.floor} · {formatMXN(unit.list_price_mxn)} · bonos: pre-venta{" "}
          {presale}% + compra directa {direct}%
        </p>
        {unit.status !== "available" ? (
          <p className="mt-3 border border-unit-held bg-deep p-3 text-sm text-unit-held">
            Esta unidad ya no está disponible. Regresa al plano y elige otra.
          </p>
        ) : null}
      </div>

      {unit.status === "available" ? (
        <DirectWizard
          unitId={unit.id}
          listPrice={unit.list_price_mxn}
          presaleBonusPct={presale}
          directBonusPct={direct}
        />
      ) : null}
    </div>
  );
}
