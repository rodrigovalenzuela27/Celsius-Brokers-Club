"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMXN } from "@/lib/format";
import { UNIT_STATUS_LABEL, type Unit, type UnitStatus } from "@/lib/types";

const STATUS_FILL: Record<UnitStatus, string> = {
  available: "var(--color-unit-available)",
  held: "var(--color-unit-held)",
  reserved: "var(--color-unit-held)",
  sold: "var(--color-unit-sold)",
  inactive: "var(--color-stone)",
};

const CELL_W = 76;
const CELL_H = 28;
const GAP = 4;
const MARGIN_X = 56;
const MARGIN_Y = 16;

/**
 * Visualizador del edificio (doc de arquitectura §09).
 * Data-driven: la geometría sale de unit.svg_coords ({floor, pos}),
 * no de constantes — funciona para cualquier proyecto.
 * Se suscribe a Supabase Realtime: si otra sesión aparta o vende una
 * unidad, el color cambia en vivo (sujeto a RLS).
 */
export function BuildingVisualizer({
  projectId,
  initialUnits,
}: {
  projectId: string;
  initialUnits: Unit[];
}) {
  const [units, setUnits] = useState(initialUnits);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`units-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "unit",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const updated = payload.new as Unit;
          setUnits((prev) =>
            prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
          );
        },
      )
      .subscribe();

    return () => {
      // Si el WebSocket no conecta (p. ej. puerto no forwardeado en
      // Codespaces) la vista sigue funcionando, solo sin updates en vivo.
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const { floors, maxPos } = useMemo(() => {
    const placed = units.filter((u) => u.svg_coords);
    const fs = [...new Set(placed.map((u) => u.svg_coords!.floor))].sort(
      (a, b) => b - a,
    );
    const mp = Math.max(1, ...placed.map((u) => u.svg_coords!.pos));
    return { floors: fs, maxPos: mp };
  }, [units]);

  const selected = units.find((u) => u.id === selectedId) ?? null;

  const width = MARGIN_X + maxPos * (CELL_W + GAP) + 16;
  const height = MARGIN_Y + floors.length * (CELL_H + GAP) + 16;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      <div className="overflow-x-auto border border-hairline bg-deep p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-130 w-full"
          role="img"
          aria-label="Disponibilidad de unidades por piso"
        >
          {floors.map((floor, row) => (
            <g key={floor}>
              <text
                x={MARGIN_X - 12}
                y={MARGIN_Y + row * (CELL_H + GAP) + CELL_H / 2 + 4}
                textAnchor="end"
                className="fill-graphite font-mono"
                fontSize="10"
              >
                N{String(floor).padStart(2, "0")}
              </text>
              {units
                .filter((u) => u.svg_coords?.floor === floor)
                .map((u) => {
                  const x = MARGIN_X + (u.svg_coords!.pos - 1) * (CELL_W + GAP);
                  const y = MARGIN_Y + row * (CELL_H + GAP);
                  const isSelected = u.id === selectedId;
                  return (
                    <g
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className="cursor-pointer"
                      role="button"
                      aria-label={`Unidad ${u.unit_number} · ${UNIT_STATUS_LABEL[u.status]}`}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={CELL_W}
                        height={CELL_H}
                        fill={STATUS_FILL[u.status]}
                        stroke={
                          isSelected ? "var(--color-accent)" : "transparent"
                        }
                        strokeWidth={isSelected ? 2 : 0}
                        opacity={u.status === "sold" ? 0.55 : 1}
                      />
                      <text
                        x={x + CELL_W / 2}
                        y={y + CELL_H / 2 + 3.5}
                        textAnchor="middle"
                        className="fill-ink font-mono"
                        fontSize="10"
                        pointerEvents="none"
                      >
                        {u.unit_number}
                      </text>
                    </g>
                  );
                })}
            </g>
          ))}
        </svg>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-hairline pt-3">
          {(["available", "held", "sold"] as const).map((s) => (
            <span key={s} className="flex items-center gap-2 text-xs text-graphite">
              <span
                className="inline-block h-3 w-3"
                style={{ background: STATUS_FILL[s] }}
              />
              {s === "held" ? "Apartada / Reservada" : UNIT_STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      <aside className="border border-hairline bg-deep p-5">
        {selected ? (
          <>
            <p className="section-mark mb-3">Unidad · {selected.unit_number}</p>
            <p className="mb-1 text-2xl tracking-tight">
              {formatMXN(selected.list_price_mxn)}
            </p>
            <p
              className="mb-4 text-xs uppercase tracking-wider"
              style={{ color: STATUS_FILL[selected.status] }}
            >
              {UNIT_STATUS_LABEL[selected.status]}
            </p>
            <dl className="space-y-2 text-sm">
              {[
                ["Superficie", `${selected.m2} m²`],
                ["Recámaras", String(selected.bedrooms)],
                ["Baños", String(selected.bathrooms)],
                ["Cajones", String(selected.parking_spots)],
                ["Bodega", selected.has_storage ? "Sí" : "No"],
                ["Orientación", selected.orientation ?? "—"],
                ["Piso", String(selected.floor)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-hairline pb-1.5">
                  <dt className="text-graphite">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {selected.status === "available" ? (
              <Link
                href={`/broker/quote/new?unit=${selected.id}`}
                className="mt-5 block w-full bg-accent px-4 py-2.5 text-center text-sm font-medium text-deep transition-colors hover:bg-accent-hover"
              >
                Generar cotización →
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="mt-5 w-full bg-accent px-4 py-2.5 text-sm font-medium text-deep opacity-40"
              >
                No disponible
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-graphite">
            Selecciona una unidad en el plano para ver su ficha técnica.
          </p>
        )}
      </aside>
    </div>
  );
}
