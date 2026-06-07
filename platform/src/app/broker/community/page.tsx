import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  CompleteCourseButton,
  EnrollCourseButton,
  RegisterEventButton,
} from "./buttons";

type EventRow = {
  id: string;
  title: string;
  kind: string;
  starts_at: string;
  location: string | null;
  capacity: number | null;
  points: number;
};
type Registration = { event_id: string; attended: boolean };
type Course = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  duration_min: number;
  points_cost: number;
  points_reward: number;
};
type Enrollment = { course_id: string; status: string };

const KIND: Record<string, string> = {
  webinar: "Webinar",
  showroom: "Open house",
  networking: "Networking",
  lanzamiento: "Lanzamiento",
};

/** Eventos & Academia (§13–14 del prototipo). */
export default async function CommunityPage() {
  await requireProfile(["broker_internal", "broker_external"]);
  const supabase = await createClient();

  const [{ data: events }, { data: regs }, { data: courses }, { data: enrollments }] =
    await Promise.all([
      supabase
        .from("event")
        .select("id, title, kind, starts_at, location, capacity, points")
        .eq("active", true)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .returns<EventRow[]>(),
      supabase.from("event_registration").select("event_id, attended").returns<Registration[]>(),
      supabase
        .from("course")
        .select("id, title, category, description, duration_min, points_cost, points_reward")
        .eq("active", true)
        .order("points_cost")
        .returns<Course[]>(),
      supabase.from("course_enrollment").select("course_id, status").returns<Enrollment[]>(),
    ]);

  const regFor = (id: string) => (regs ?? []).find((r) => r.event_id === id);
  const enrFor = (id: string) => (enrollments ?? []).find((e) => e.course_id === id);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§13–14 · Eventos & Academia</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">Comunidad</h1>
      <p className="mb-8 text-sm text-graphite">
        Asistir a eventos y completar cursos suma puntos Rewards. Los cursos
        premium se pagan con tu saldo de puntos.
      </p>

      <p className="section-mark mb-3">Próximos eventos</p>
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(events ?? []).map((e) => {
          const reg = regFor(e.id);
          return (
            <div key={e.id} className="border border-hairline bg-deep p-5">
              <p className="section-mark mb-2 !text-accent">{KIND[e.kind] ?? e.kind}</p>
              <h3 className="mb-1 text-base">{e.title}</h3>
              <p className="mb-3 text-xs text-graphite">
                {new Date(e.starts_at).toLocaleString("es-MX", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {e.location ? ` · ${e.location}` : ""}
                {" · "}+{e.points} pts por asistir
              </p>
              {reg ? (
                <p className="text-xs text-unit-available">
                  ✓ Registrado{reg.attended ? " · asistencia acreditada" : ""}
                </p>
              ) : (
                <RegisterEventButton eventId={e.id} />
              )}
            </div>
          );
        })}
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-graphite">Sin eventos próximos.</p>
        ) : null}
      </div>

      <p className="section-mark mb-3">Academia · cursos</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(courses ?? []).map((c) => {
          const enr = enrFor(c.id);
          return (
            <div key={c.id} className="border border-hairline bg-deep p-5">
              <div className="mb-1 flex items-baseline justify-between">
                <p className="section-mark !text-accent">{c.category}</p>
                <span className="font-mono text-xs text-graphite">{c.duration_min} min</span>
              </div>
              <h3 className="mb-1 text-base">{c.title}</h3>
              <p className="mb-3 text-xs text-graphite">
                {c.description} · al completar: +{c.points_reward} pts
              </p>
              {!enr ? (
                <EnrollCourseButton courseId={c.id} cost={c.points_cost} />
              ) : enr.status === "enrolled" ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-accent-soft">En curso</span>
                  <CompleteCourseButton courseId={c.id} />
                </div>
              ) : (
                <p className="text-xs text-unit-available">✓ Completado</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
