import { ApplyForm } from "./apply-form";

export const metadata = { title: "Quiero ser broker · Celsius" };

export default function BrokerApplyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="section-mark mb-4 !text-accent">§ Ruta C · Alta de brokers</p>
      <h1 className="mb-2 text-3xl font-normal tracking-tight">
        Quiero ser broker
      </h1>
      <p className="mb-10 max-w-xl text-sm text-graphite">
        Vende el inventario Celsius con comisión base del 2.5% + bonos.
        Completa tus datos, sube tu documentación y el equipo revisa en máximo
        3 días hábiles.
      </p>
      <ApplyForm />
    </div>
  );
}
