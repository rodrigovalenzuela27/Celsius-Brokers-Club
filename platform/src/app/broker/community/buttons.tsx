"use client";

import { useActionState } from "react";
import {
  completeCourse,
  enrollCourse,
  registerEvent,
  type ActionState,
} from "./actions";

const btn =
  "border border-accent px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-deep disabled:opacity-50";

function RpcButton({
  action,
  hiddenName,
  hiddenValue,
  label,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  hiddenName: string;
  hiddenValue: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name={hiddenName} value={hiddenValue} />
      <button type="submit" disabled={pending} className={btn}>
        {pending ? "…" : label}
      </button>
      {state.ok ? <p className="mt-1 text-xs text-unit-available">✓ {state.ok}</p> : null}
      {state.error ? <p role="alert" className="mt-1 text-xs text-red-400">{state.error}</p> : null}
    </form>
  );
}

export const RegisterEventButton = ({ eventId }: { eventId: string }) => (
  <RpcButton action={registerEvent} hiddenName="event_id" hiddenValue={eventId} label="Registrarme →" />
);

export const EnrollCourseButton = ({ courseId, cost }: { courseId: string; cost: number }) => (
  <RpcButton
    action={enrollCourse}
    hiddenName="course_id"
    hiddenValue={courseId}
    label={cost > 0 ? `Inscribirme · ${cost} pts` : "Inscribirme · gratis"}
  />
);

export const CompleteCourseButton = ({ courseId }: { courseId: string }) => (
  <RpcButton action={completeCourse} hiddenName="course_id" hiddenValue={courseId} label="Marcar completado" />
);
