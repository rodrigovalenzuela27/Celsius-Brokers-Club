import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Discount } from "@/lib/quote-engine";

// Tokens ACORN/Celsius aplicados al PDF (doc de arquitectura §12).
const C = {
  deep: "#1E1E1E",
  canvas: "#383838",
  ink: "#F5F5F5",
  graphite: "#8A8A8A",
  accent: "#009DEA",
  hairline: "#D8D8D8",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 48, color: "#222" },
  header: {
    backgroundColor: C.deep,
    color: C.ink,
    padding: 20,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  brand: { fontSize: 18, letterSpacing: 1 },
  headerMeta: { fontSize: 8, color: C.graphite, textAlign: "right" },
  kicker: {
    fontSize: 7,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: C.accent,
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 12, marginBottom: 8 },
  block: { marginBottom: 18 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
    paddingVertical: 4,
  },
  rowLabel: { color: "#555" },
  strong: { fontSize: 11 },
  accent: { color: C.accent },
  banner: {
    backgroundColor: C.deep,
    color: C.ink,
    padding: 12,
    marginTop: 12,
    textAlign: "center",
    fontSize: 9,
    letterSpacing: 1,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    fontSize: 7,
    color: "#777",
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
    paddingTop: 8,
  },
});

export type QuotePdfData = {
  folio: string;
  createdAt: string;
  validUntil: string | null;
  holdExpiresAt: string | null;
  client: { full_name: string; email: string; rfc: string | null };
  unit: {
    unit_number: string;
    m2: number;
    bedrooms: number;
    bathrooms: number;
    floor: number;
    project: { name: string; code: string };
  };
  brokerName: string;
  listPrice: number;
  discounts: Discount[];
  netPrice: number;
  downPaymentPct: number;
  downPayment: number;
  months: number;
  monthlyPayment: number;
  balanceAtClose: number;
};

const mxn = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—";

export function QuotePdf({ data }: { data: QuotePdfData }) {
  return (
    <Document title={`Cotización ${data.folio}`} author="Celsius">
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>CELSIUS</Text>
          <View>
            <Text style={s.headerMeta}>COTIZACIÓN · {data.folio}</Text>
            <Text style={s.headerMeta}>EMITIDA · {fecha(data.createdAt)}</Text>
            <Text style={s.headerMeta}>VIGENCIA · {fecha(data.validUntil)}</Text>
          </View>
        </View>

        <View style={s.block}>
          <Text style={s.kicker}>§01 · Cliente</Text>
          <View style={s.row}>
            <Text style={s.rowLabel}>Nombre</Text>
            <Text>{data.client.full_name}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Correo</Text>
            <Text>{data.client.email}</Text>
          </View>
          {data.client.rfc ? (
            <View style={s.row}>
              <Text style={s.rowLabel}>RFC</Text>
              <Text>{data.client.rfc}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.block}>
          <Text style={s.kicker}>§02 · Unidad</Text>
          <View style={s.row}>
            <Text style={s.rowLabel}>Proyecto</Text>
            <Text>
              {data.unit.project.name} ({data.unit.project.code})
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Unidad</Text>
            <Text>Depto {data.unit.unit_number} · piso {data.unit.floor}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Especificaciones</Text>
            <Text>
              {data.unit.m2} m² · {data.unit.bedrooms} recámaras · {data.unit.bathrooms} baños
            </Text>
          </View>
        </View>

        <View style={s.block}>
          <Text style={s.kicker}>§03 · Esquema financiero</Text>
          <View style={s.row}>
            <Text style={s.rowLabel}>Precio lista</Text>
            <Text>{mxn(data.listPrice)}</Text>
          </View>
          {data.discounts.map((d) => (
            <View key={d.concept} style={s.row}>
              <Text style={s.rowLabel}>{d.concept}</Text>
              <Text style={s.accent}>−{mxn(d.amount)}</Text>
            </View>
          ))}
          <View style={s.row}>
            <Text style={[s.rowLabel, s.strong]}>Precio neto</Text>
            <Text style={s.strong}>{mxn(data.netPrice)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Enganche ({data.downPaymentPct}%)</Text>
            <Text>{mxn(data.downPayment)}</Text>
          </View>
          {data.months > 0 ? (
            <View style={s.row}>
              <Text style={s.rowLabel}>{data.months} mensualidades durante obra</Text>
              <Text>{mxn(data.monthlyPayment)} /mes</Text>
            </View>
          ) : null}
          <View style={s.row}>
            <Text style={s.rowLabel}>Saldo al cierre</Text>
            <Text>{mxn(data.balanceAtClose)}</Text>
          </View>
        </View>

        {data.holdExpiresAt ? (
          <View style={s.banner}>
            <Text>
              UNIDAD APARTADA · EXPIRA {fecha(data.holdExpiresAt).toUpperCase()}
            </Text>
          </View>
        ) : null}

        <View style={s.footer}>
          <Text>
            Atiende: {data.brokerName} · Celsius. Cotización informativa sujeta a
            disponibilidad y firma de promesa de compraventa. Los datos personales
            se tratan conforme al aviso de privacidad vigente (LFPDPPP).
          </Text>
        </View>
      </Page>
    </Document>
  );
}
