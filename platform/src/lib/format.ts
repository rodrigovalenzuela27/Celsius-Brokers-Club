const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function formatMXN(value: number): string {
  return mxn.format(value);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
  }).format(new Date(iso));
}
