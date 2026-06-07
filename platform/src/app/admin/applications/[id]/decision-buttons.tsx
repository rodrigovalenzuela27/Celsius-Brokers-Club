"use client";

import { useActionState } from "react";
import {
  approveApplication,
  rejectApplication,
  type DecisionState,
} from "../actions";

export function DecisionButtons({ applicationId }: { applicationId: string }) {
  const [approveState, approveAction, approving] = useActionState<
    DecisionState,
    FormData
  >(approveApplication, {});
  const [rejectState, rejectAction, rejecting] = useActionState<
    DecisionState,
    FormData
  >(rejectApplication, {});

  if (approveState.ok) {
    return (
      <div className="border border-unit-available bg-canvas p-4">
        <p className="text-sm" style={{ color: "var(--color-unit-available)" }}>
          ✓ {approveState.ok}
        </p>
        {approveState.tempPassword ? (
          <p className="mt-2 text-xs text-graphite">
            Password temporal (entrégalo por canal seguro; en cloud será
            invitación por correo):{" "}
            <span className="font-mono text-accent">{approveState.tempPassword}</span>
          </p>
        ) : null}
      </div>
    );
  }
  if (rejectState.ok) {
    return <p className="text-sm text-graphite">✕ {rejectState.ok}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <form action={approveAction}>
          <input type="hidden" name="application_id" value={applicationId} />
          <button
            type="submit"
            disabled={approving || rejecting}
            className="bg-accent px-4 py-2 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
          >
            {approving ? "Aprobando…" : "Aprobar y crear cuenta"}
          </button>
        </form>
        <form action={rejectAction} className="flex gap-2">
          <input type="hidden" name="application_id" value={applicationId} />
          <input
            name="notes"
            placeholder="Motivo (opcional)"
            className="border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-stone focus:border-accent"
          />
          <button
            type="submit"
            disabled={approving || rejecting}
            className="border border-hairline px-4 py-2 text-sm text-graphite hover:border-red-400 hover:text-red-400 disabled:opacity-60"
          >
            Rechazar
          </button>
        </form>
      </div>
      {approveState.error || rejectState.error ? (
        <p role="alert" className="text-sm text-red-400">
          {approveState.error ?? rejectState.error}
        </p>
      ) : null}
    </div>
  );
}
