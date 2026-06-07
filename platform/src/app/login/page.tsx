import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión · Celsius" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm border border-hairline bg-deep p-8">
        <p className="section-mark mb-5 !text-accent">
          § Acceso · plataforma Celsius
        </p>
        <h1 className="mb-2 text-2xl font-normal tracking-tight">Celsius</h1>
        <p className="mb-8 text-sm text-graphite">
          Cotizador, inventario y consola operativa. Acceso para brokers y
          administración.
        </p>
        <LoginForm next={next} />
        <p className="mt-6 border-t border-hairline pt-4 text-xs text-graphite">
          ¿No tienes cuenta? El alta de brokers se gestiona por invitación de
          administración Celsius.
        </p>
      </div>
    </main>
  );
}
