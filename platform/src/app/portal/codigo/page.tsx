import { CodeForm } from "./code-form";

export const metadata = { title: "Tengo un código · Celsius" };

export default function CodePage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-6 py-20">
      <p className="section-mark mb-4 !text-accent">§ Cotización compartida</p>
      <h1 className="mb-2 text-2xl font-normal tracking-tight">
        Tengo un código
      </h1>
      <p className="mb-8 text-sm text-graphite">
        Tu broker te compartió una cotización. Entra con tu correo y el código
        para revisarla y, si te convence, pagar tu enganche en línea.
      </p>
      <CodeForm />
    </div>
  );
}
