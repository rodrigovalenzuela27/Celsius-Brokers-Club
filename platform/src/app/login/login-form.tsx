"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="flex flex-col gap-1.5">
        <span className="section-mark">Correo</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@correo.mx"
          className="border border-hairline-strong bg-deep px-3.5 py-3 text-sm text-ink outline-none placeholder:text-stone focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="section-mark">Contraseña</span>
        <input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="current-password"
          placeholder="••••••••••••"
          className="border border-hairline-strong bg-deep px-3.5 py-3 text-sm text-ink outline-none placeholder:text-stone focus:border-accent"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 bg-accent px-4 py-3 text-sm font-medium text-deep transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Iniciar sesión →"}
      </button>
    </form>
  );
}
