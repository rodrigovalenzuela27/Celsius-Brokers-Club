"use client";

import { useActionState } from "react";
import { redeemReward, type RedeemState } from "./actions";

export function RedeemButton({
  itemId,
  disabled,
  label,
}: {
  itemId: string;
  disabled?: boolean;
  label: string;
}) {
  const [state, action, pending] = useActionState<RedeemState, FormData>(
    redeemReward,
    {},
  );

  return (
    <form action={action}>
      <input type="hidden" name="item_id" value={itemId} />
      <button
        type="submit"
        disabled={disabled || pending}
        className="w-full border border-accent px-3 py-2 text-xs text-accent transition-colors hover:bg-accent hover:text-deep disabled:cursor-not-allowed disabled:border-hairline disabled:text-stone"
      >
        {pending ? "Canjeando…" : label}
      </button>
      {state.ok ? (
        <p className="mt-2 text-xs text-unit-available">✓ {state.ok}</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-2 text-xs text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
