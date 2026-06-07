import { createClient } from "@/lib/supabase/server";
import { generateDutySlots, markAttendance } from "./actions";

type EventWithRegs = {
  id: string;
  title: string;
  starts_at: string;
  points: number;
  registrations: {
    id: string;
    attended: boolean;
    broker: { full_name: string; email: string };
  }[];
};
type DutyAgg = { id: string; broker_id: string | null };

/** Operación de engagement: asistencia a eventos + guardias. */
export default async function EngagementPage() {
  const supabase = await createClient();

  const [{ data: events }, { data: duties }, { count: courses }, { count: rooms }] =
    await Promise.all([
      supabase
        .from("event")
        .select(
          "id, title, starts_at, points, registrations:event_registration(id, attended, broker:broker_id(full_name, email))",
        )
        .order("starts_at")
        .returns<EventWithRegs[]>(),
      supabase
        .from("duty_slot")
        .select("id, broker_id")
        .gte("duty_date", new Date().toISOString().slice(0, 10))
        .returns<DutyAgg[]>(),
      supabase.from("course").select("id", { count: "exact", head: true }),
      supabase.from("room").select("id", { count: "exact", head: true }),
    ]);

  const claimed = (duties ?? []).filter((d) => d.broker_id).length;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§ Engagement · operación</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">
        Eventos, guardias y academia
      </h1>
      <p className="mb-8 text-sm text-graphite">
        {rooms ?? 0} salas · {courses ?? 0} cursos · guardias próximas:{" "}
        {claimed}/{(duties ?? []).length} tomadas. Marcar asistencia acredita
        los puntos del evento.
      </p>

      <div className="mb-8 border border-hairline bg-deep p-5">
        <p className="section-mark mb-3">Guardias</p>
        <form action={generateDutySlots}>
          <button className="border border-accent px-4 py-2 text-sm text-accent hover:bg-accent hover:text-deep">
            Generar slots de la próxima semana
          </button>
        </form>
        <p className="mt-2 text-xs text-graphite">
          Idempotente: solo crea los que falten (2 turnos × showroom × 7 días).
        </p>
      </div>

      <p className="section-mark mb-3">Eventos · registros y asistencia</p>
      <div className="space-y-4">
        {(events ?? []).map((e) => (
          <div key={e.id} className="border border-hairline bg-deep p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-base">{e.title}</h3>
              <span className="text-xs text-graphite">
                {new Date(e.starts_at).toLocaleString("es-MX", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · +{e.points} pts
              </span>
            </div>
            {e.registrations.length ? (
              <ul className="text-sm">
                {e.registrations.map((r) => (
                  <li key={r.id} className="flex items-center justify-between border-t border-hairline py-2">
                    <span className="text-graphite">
                      {r.broker.full_name || r.broker.email}
                    </span>
                    {r.attended ? (
                      <span className="text-xs text-unit-available">✓ Asistió · pts acreditados</span>
                    ) : (
                      <form action={markAttendance}>
                        <input type="hidden" name="registration_id" value={r.id} />
                        <button className="border border-hairline px-3 py-1 text-xs text-graphite hover:border-accent hover:text-accent">
                          Marcar asistencia
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-graphite">Sin registros aún.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
