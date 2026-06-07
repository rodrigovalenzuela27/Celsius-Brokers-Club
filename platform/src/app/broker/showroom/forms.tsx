"use client";

import { useActionState } from "react";
import { bookRoom, claimDuty, type ActionState } from "./actions";

const field =
  "border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-stone focus:border-accent";

export function BookRoomForm({
  rooms,
}: {
  rooms: { id: string; showroom: string; name: string; capacity: number }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    bookRoom,
    {},
  );

  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <select name="room_id" required defaultValue="" className={`${field} col-span-2 sm:col-span-1`}>
        <option value="" disabled>Sala…</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.showroom} · {r.name} ({r.capacity}p)
          </option>
        ))}
      </select>
      <input name="date" type="date" required className={field} />
      <input name="time" type="time" required step={1800} min="09:00" max="18:00" className={field} />
      <select name="minutes" defaultValue="30" className={field}>
        <option value="30">30 min</option>
        <option value="60">60 min</option>
        <option value="90">90 min</option>
      </select>
      <input name="client_name" placeholder="Cliente (opcional)" className={field} />
      <input name="purpose" placeholder="Motivo (opcional)" className={field} />
      <div className="col-span-2 sm:col-span-3">
        {state.error ? (
          <p role="alert" className="mb-2 text-sm text-red-400">{state.error}</p>
        ) : null}
        {state.ok ? (
          <p className="mb-2 text-sm text-unit-available">✓ {state.ok}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="bg-accent px-4 py-2 text-sm font-medium text-deep hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Reservando…" : "Reservar sala"}
        </button>
      </div>
    </form>
  );
}

export function ClaimDutyButton({ slotId }: { slotId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    claimDuty,
    {},
  );

  return (
    <form action={action} className="inline">
      <input type="hidden" name="slot_id" value={slotId} />
      <button
        type="submit"
        disabled={pending}
        title={state.error}
        className="border border-accent px-2 py-1 text-xs text-accent hover:bg-accent hover:text-deep disabled:opacity-50"
      >
        {pending ? "…" : state.error ? "✕" : "Tomar"}
      </button>
    </form>
  );
}
