import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelBooking } from "./actions";
import { BookRoomForm, ClaimDutyButton } from "./forms";

type Room = { id: string; showroom: string; name: string; capacity: number; equipment: string | null };
type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  purpose: string | null;
  client_name: string | null;
  broker_id: string;
  cancelled_at: string | null;
  room: { showroom: string; name: string };
};
type Duty = {
  id: string;
  showroom: string;
  duty_date: string;
  shift: string;
  broker: { full_name: string; email: string } | null;
};

/** Salas & Showroom + Guardias (§11–12 del prototipo). */
export default async function ShowroomPage() {
  const profile = await requireProfile(["broker_internal", "broker_external"]);
  const supabase = await createClient();

  const [{ data: rooms }, { data: bookings }, { data: duties }] = await Promise.all([
    supabase.from("room").select("id, showroom, name, capacity, equipment").eq("bookable", true).order("showroom").returns<Room[]>(),
    supabase
      .from("room_booking")
      .select("id, starts_at, ends_at, purpose, client_name, broker_id, cancelled_at, room:room_id(showroom, name)")
      .is("cancelled_at", null)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .returns<Booking[]>(),
    supabase
      .from("duty_slot")
      .select("id, showroom, duty_date, shift, broker:broker_id(full_name, email)")
      .gte("duty_date", new Date().toISOString().slice(0, 10))
      .order("duty_date")
      .returns<Duty[]>(),
  ]);

  const mine = (bookings ?? []).filter((b) => b.broker_id === profile.id);
  const others = (bookings ?? []).filter((b) => b.broker_id !== profile.id);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-5xl">
      <p className="section-mark mb-2">§11–12 · Salas & Guardias</p>
      <h1 className="mb-1 text-2xl font-normal tracking-tight">Showroom</h1>
      <p className="mb-8 text-sm text-graphite">
        Reglas: máximo 3 reservas activas · cancela hasta 4h antes · el solape
        lo impide la base de datos. Cada guardia suma +30 pts.
      </p>

      <div className="mb-8 border border-hairline bg-deep p-5">
        <p className="section-mark mb-4">Reservar sala</p>
        <BookRoomForm rooms={rooms ?? []} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="section-mark mb-3">Mis reservas</p>
          {mine.length ? (
            <ul className="border border-hairline bg-deep p-4 text-sm">
              {mine.map((b) => (
                <li key={b.id} className="flex items-center justify-between border-b border-hairline py-2 last:border-0">
                  <span>
                    {b.room.showroom} · {b.room.name}
                    <span className="ml-2 text-xs text-graphite">
                      {fmt(b.starts_at)}
                      {b.client_name ? ` · ${b.client_name}` : ""}
                    </span>
                  </span>
                  <form action={cancelBooking}>
                    <input type="hidden" name="booking_id" value={b.id} />
                    <button className="border border-hairline px-2 py-1 text-xs text-graphite hover:border-red-400 hover:text-red-400">
                      Cancelar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border border-hairline bg-deep p-4 text-sm text-graphite">
              Sin reservas próximas.
            </p>
          )}
        </div>
        <div>
          <p className="section-mark mb-3">Agenda ocupada (otros brokers)</p>
          <ul className="border border-hairline bg-deep p-4 text-sm text-graphite">
            {others.length ? (
              others.slice(0, 8).map((b) => (
                <li key={b.id} className="border-b border-hairline py-2 last:border-0">
                  {b.room.showroom} · {b.room.name} — {fmt(b.starts_at)}
                </li>
              ))
            ) : (
              <li>Todo libre.</li>
            )}
          </ul>
        </div>
      </div>

      <p className="section-mark mb-3">Guardias · próximos 7 días (+30 pts)</p>
      <table className="w-full border border-hairline text-sm">
        <thead>
          <tr className="bg-deep text-left">
            {["Fecha", "Showroom", "Turno", "Broker", ""].map((h) => (
              <th key={h} scope="col" className="section-mark px-4 py-3 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(duties ?? []).map((d) => (
            <tr key={d.id} className="border-t border-hairline hover:bg-deep">
              <td className="px-4 py-2.5">
                {new Date(d.duty_date + "T12:00:00").toLocaleDateString("es-MX", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </td>
              <td className="px-4 py-2.5 text-graphite">{d.showroom}</td>
              <td className="px-4 py-2.5 text-graphite">
                {d.shift === "matutino" ? "Matutino · 9–14" : "Vespertino · 14–19"}
              </td>
              <td className="px-4 py-2.5">
                {d.broker ? (
                  <span className={d.broker.email === profile.email ? "text-accent" : "text-graphite"}>
                    {d.broker.full_name || d.broker.email}
                  </span>
                ) : (
                  <span className="text-stone">Libre</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                {!d.broker ? <ClaimDutyButton slotId={d.id} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
