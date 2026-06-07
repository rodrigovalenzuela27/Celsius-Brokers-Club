// Tipos de dominio compartidos (fase 1: inventario).
// En fase 2 se evalúa generar tipos desde el schema con supabase gen types.

export type ProjectStatus = "presale" | "selling" | "sold_out" | "delivered";
export type UnitStatus = "available" | "held" | "reserved" | "sold" | "inactive";

export type Project = {
  id: string;
  code: string;
  name: string;
  location: string;
  address: string | null;
  status: ProjectStatus;
  delivery_date: string | null;
  levels: number | null;
  tech_specs: {
    towers?: number;
    units_per_floor?: number;
    amenities?: string[];
    certification?: string;
  };
};

export type Unit = {
  id: string;
  project_id: string;
  unit_number: string;
  floor: number;
  m2: number;
  bedrooms: number;
  bathrooms: number;
  parking_spots: number;
  has_storage: boolean;
  orientation: string | null;
  view_description: string | null;
  list_price_mxn: number;
  status: UnitStatus;
  svg_coords: { floor: number; pos: number } | null;
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  presale: "Pre-venta",
  selling: "Venta activa",
  sold_out: "Agotado",
  delivered: "Entregado",
};

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  available: "Disponible",
  held: "Apartada 24h",
  reserved: "Reservada",
  sold: "Vendida",
  inactive: "Inactiva",
};
