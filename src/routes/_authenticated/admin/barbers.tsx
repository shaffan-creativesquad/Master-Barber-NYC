import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getAdminConfig, upsertBarber, deleteBarber, setBarberSchedule, addBarberTimeOff, removeBarberTimeOff } from "@/lib/admin.functions";
import { Loader2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/barbers")({
  head: () => ({
    meta: [
      { title: "Barbers | Admin | Master Barber NYC" },
      { name: "description", content: "Manage barbers and schedules for Master Barber NYC." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BarbersPage,
});

type Barber = {
  id?: string; name: string; bio: string | null; specialty: string | null;
  experience_years: number | null; photo_url: string | null; active: boolean;
  sort_order: number; location_ids: string[];
};
type Loc = { id: string; name: string };
type Schedule = { location_id: string; weekday: number; start_time: string; end_time: string };
type TimeOff = { id: string; barber_id: string; start_at: string; end_at: string; reason: string | null };

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const EMPTY: Barber = { name: "", bio: "", specialty: "", experience_years: 0, photo_url: "", active: true, sort_order: 100, location_ids: [] };

function BarbersPage() {
  const cfgFn = useServerFn(getAdminConfig);
  const saveFn = useServerFn(upsertBarber);
  const delFn = useServerFn(deleteBarber);
  const schedFn = useServerFn(setBarberSchedule);
  const addOffFn = useServerFn(addBarberTimeOff);
  const delOffFn = useServerFn(removeBarberTimeOff);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [allSchedules, setAllSchedules] = useState<(Schedule & { barber_id: string })[]>([]);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [scheduling, setScheduling] = useState<{ barber: Barber; entries: Schedule[] } | null>(null);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [offFor, setOffFor] = useState<Barber | null>(null);
  const [offStart, setOffStart] = useState("");
  const [offEnd, setOffEnd] = useState("");
  const [offReason, setOffReason] = useState("");
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    const c = await cfgFn();
    const withLocs: Barber[] = (c.barbers as Omit<Barber, "location_ids">[]).map((b) => ({
      ...b,
      location_ids: c.barber_locations.filter((bl) => bl.barber_id === b.id).map((bl) => bl.location_id),
    }));
    setBarbers(withLocs);
    setLocations(c.locations.map((l) => ({ id: l.id, name: l.name })));
    setAllSchedules(c.barber_schedules as (Schedule & { barber_id: string })[]);
    setTimeOff(c.barber_time_off as TimeOff[]);
    setBusy(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!editing) return;
    setErr(null);
    try {
      await saveFn({ data: {
        id: editing.id, name: editing.name, bio: editing.bio || null, specialty: editing.specialty || null,
        experience_years: editing.experience_years ?? 0, photo_url: editing.photo_url || null,
        active: editing.active, sort_order: Number(editing.sort_order), location_ids: editing.location_ids,
      } });
      setEditing(null); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  function openSchedule(b: Barber) {
    const entries = allSchedules.filter((s) => s.barber_id === b.id).map((s) => ({ location_id: s.location_id, weekday: s.weekday, start_time: s.start_time.slice(0,5), end_time: s.end_time.slice(0,5) }));
    setScheduling({ barber: b, entries });
  }

  async function saveSchedule() {
    if (!scheduling || !scheduling.barber.id) return;
    await schedFn({ data: { barber_id: scheduling.barber.id, entries: scheduling.entries } });
    setScheduling(null);
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><div className="eyebrow">Team</div><h1 className="mt-2 font-display text-3xl">Barbers</h1></div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-gold"><Plus className="mr-2 inline h-4 w-4" />New barber</button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {busy && <div className="col-span-full text-cream/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</div>}
        {barbers.map((b) => (
          <div key={b.id} className="rounded-sm border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center gap-4">
              {b.photo_url ? <img src={b.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="h-14 w-14 rounded-full border border-gold/40 bg-gold/10" />}
              <div>
                <div className="font-display text-lg">{b.name}</div>
                <div className="text-xs text-cream/50">{b.specialty}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-cream/50">{b.experience_years ?? 0} yrs · {b.active ? "Active" : "Inactive"}</div>
            <div className="mt-4 flex gap-3 text-xs uppercase tracking-[0.16em]">
              <button onClick={() => setEditing({ ...b })} className="text-gold">Edit</button>
              <button onClick={() => openSchedule(b)} className="text-cream/70 hover:text-gold">Schedule</button>
              <button onClick={() => { setOffFor(b); setOffStart(""); setOffEnd(""); setOffReason(""); }} className="text-cream/70 hover:text-gold">Time off</button>
              {b.active && b.id && <button onClick={async () => { if (confirm("Deactivate?")) { await delFn({ data: { id: b.id! } }); await load(); } }} className="text-red-300">Deactivate</button>}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-lg rounded-sm border border-white/10 bg-ink p-8">
            <div className="flex items-start justify-between">
              <h2 className="font-display text-2xl">{editing.id ? "Edit barber" : "New barber"}</h2>
              <button onClick={() => setEditing(null)} className="text-cream/60 hover:text-gold">✕</button>
            </div>
            <div className="mt-6 grid gap-4">
              <F label="Name"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={input} /></F>
              <F label="Specialty"><input value={editing.specialty ?? ""} onChange={(e) => setEditing({ ...editing, specialty: e.target.value })} className={input} /></F>
              <F label="Bio"><textarea value={editing.bio ?? ""} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} rows={3} className={input} /></F>
              <F label="Photo URL"><input value={editing.photo_url ?? ""} onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })} className={input} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Experience (yrs)"><input type="number" value={editing.experience_years ?? 0} onChange={(e) => setEditing({ ...editing, experience_years: Number(e.target.value) })} className={input} /></F>
                <F label="Sort"><input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={input} /></F>
              </div>
              <F label="Locations">
                <div className="mt-1 space-y-2">
                  {locations.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={editing.location_ids.includes(l.id)}
                        onChange={(e) => setEditing({ ...editing, location_ids: e.target.checked ? [...editing.location_ids, l.id] : editing.location_ids.filter((x) => x !== l.id) })} />
                      {l.name}
                    </label>
                  ))}
                </div>
              </F>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
            </div>
            {err && <div className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="text-xs uppercase tracking-[0.24em] text-cream/60">Cancel</button>
              <button onClick={save} className="btn-gold">Save</button>
            </div>
          </div>
        </div>
      )}

      {scheduling && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-sm border border-white/10 bg-ink p-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="eyebrow">Schedule</div>
                <h2 className="mt-2 font-display text-2xl">{scheduling.barber.name}</h2>
              </div>
              <button onClick={() => setScheduling(null)} className="text-cream/60 hover:text-gold">✕</button>
            </div>
            <div className="mt-6 space-y-3">
              {scheduling.entries.map((e, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2">
                  <F label="Location"><select value={e.location_id} onChange={(ev) => update(i, { location_id: ev.target.value })} className={input}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></F>
                  <F label="Day"><select value={e.weekday} onChange={(ev) => update(i, { weekday: Number(ev.target.value) })} className={input}>{DAYS.map((d, di) => <option key={di} value={di}>{d}</option>)}</select></F>
                  <F label="Start"><input type="time" value={e.start_time} onChange={(ev) => update(i, { start_time: ev.target.value })} className={input} /></F>
                  <F label="End"><input type="time" value={e.end_time} onChange={(ev) => update(i, { end_time: ev.target.value })} className={input} /></F>
                  <button onClick={() => remove(i)} className="pb-2 text-xs uppercase tracking-[0.16em] text-red-300">Remove</button>
                </div>
              ))}
              <button onClick={add} className="text-xs uppercase tracking-[0.24em] text-gold">+ Add shift</button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setScheduling(null)} className="text-xs uppercase tracking-[0.24em] text-cream/60">Cancel</button>
              <button onClick={saveSchedule} className="btn-gold">Save schedule</button>
            </div>
          </div>
        </div>
      )}

      {offFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-lg rounded-sm border border-white/10 bg-ink p-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="eyebrow">Time off</div>
                <h2 className="mt-2 font-display text-2xl">{offFor.name}</h2>
                <p className="mt-1 text-xs text-cream/50">Days listed here can't be booked online.</p>
              </div>
              <button onClick={() => setOffFor(null)} className="text-cream/60 hover:text-gold">✕</button>
            </div>

            <div className="mt-6 space-y-2">
              {timeOff.filter((t) => t.barber_id === offFor.id).length === 0 && (
                <div className="text-sm text-cream/50">No time off scheduled.</div>
              )}
              {timeOff.filter((t) => t.barber_id === offFor.id).map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-sm border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
                  <div>
                    <div>{fmtOff(t.start_at)} → {fmtOff(t.end_at)}</div>
                    {t.reason && <div className="text-xs text-cream/50">{t.reason}</div>}
                  </div>
                  <button onClick={() => deleteTimeOff(t.id)} className="text-xs uppercase tracking-[0.16em] text-red-300">Remove</button>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 border-t border-white/10 pt-6">
              <div className="grid grid-cols-2 gap-3">
                <F label="First day off"><input type="date" value={offStart} onChange={(e) => setOffStart(e.target.value)} className={input} /></F>
                <F label="Last day off"><input type="date" value={offEnd} onChange={(e) => setOffEnd(e.target.value)} className={input} /></F>
              </div>
              <F label="Reason (optional)"><input value={offReason} onChange={(e) => setOffReason(e.target.value)} placeholder="e.g. Vacation, sick day" className={input} /></F>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setOffFor(null)} className="text-xs uppercase tracking-[0.24em] text-cream/60">Close</button>
              <button onClick={saveTimeOff} disabled={!offStart} className="btn-gold disabled:opacity-40">Add time off</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  async function saveTimeOff() {
    if (!offFor?.id || !offStart) return;
    await addOffFn({ data: { barber_id: offFor.id, start_date: offStart, end_date: offEnd || offStart, reason: offReason || undefined } });
    await load();
  }
  async function deleteTimeOff(id: string) {
    await delOffFn({ data: { id } });
    await load();
  }

  function update(i: number, patch: Partial<Schedule>) {
    if (!scheduling) return;
    const next = [...scheduling.entries];
    next[i] = { ...next[i], ...patch };
    setScheduling({ ...scheduling, entries: next });
  }
  function remove(i: number) {
    if (!scheduling) return;
    setScheduling({ ...scheduling, entries: scheduling.entries.filter((_, x) => x !== i) });
  }
  function add() {
    if (!scheduling) return;
    const loc = locations[0]?.id ?? "";
    setScheduling({ ...scheduling, entries: [...scheduling.entries, { location_id: loc, weekday: 1, start_time: "09:00", end_time: "17:00" }] });
  }
}

const input = "w-full rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-sm";
function fmtOff(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/60">{label}</span><div className="mt-2">{children}</div></label>;
}
