import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listAppointments, updateAppointmentStatus, rescheduleAppointment, getAdminConfig, cancelWithFee } from "@/lib/admin.functions";
import { StatusPill } from "./index";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments | Admin | Master Barber NYC" },
      { name: "description", content: "Manage appointments for Master Barber NYC." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Appointments,
});

type Row = Awaited<ReturnType<typeof listAppointments>>[number];

const STATUSES = ["pending","confirmed","checked_in","completed","cancelled","no_show"] as const;

function Appointments() {
  const listFn = useServerFn(listAppointments);
  const updateFn = useServerFn(updateAppointmentStatus);
  const reschedFn = useServerFn(rescheduleAppointment);
  const cfgFn = useServerFn(getAdminConfig);
  const feeFn = useServerFn(cancelWithFee);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  async function reload() {
    setBusy(true); setErr(null);
    try {
      const r = await listFn({ data: { status: status || undefined, location_id: locationId || null } });
      setRows(r);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    cfgFn().then((c) => setLocations(c.locations.map((l) => ({ id: l.id, name: l.name }))));
  }, [cfgFn]);
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status, locationId]);

  return (
    <div>
      <div className="eyebrow">Bookings</div>
      <h1 className="mt-2 font-display text-3xl">Appointments</h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
        </select>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-sm">
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button onClick={reload} className="text-xs uppercase tracking-[0.24em] text-cream/60 hover:text-gold">Refresh</button>
      </div>

      {err && <div className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-red-200">{err}</div>}

      <div className="mt-6 overflow-x-auto rounded-sm border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-[10px] uppercase tracking-[0.16em] text-cream/50">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Barber</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {busy && <tr><td colSpan={7} className="px-4 py-8 text-center text-cream/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</td></tr>}
            {!busy && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-cream/50">No appointments.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <div>{new Date(r.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                  <div className="text-xs text-cream/50">{new Date(r.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{r.customers?.first_name} {r.customers?.last_name}</div>
                  <div className="text-xs text-cream/50">{r.customers?.phone}</div>
                </td>
                <td className="px-4 py-3">{r.services?.name}</td>
                <td className="px-4 py-3">{r.barbers?.name ?? "-"}</td>
                <td className="px-4 py-3">{r.locations?.name}</td>
                <td className="px-4 py-3"><StatusPill status={r.status as string} /></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setSelected(r)} className="text-xs uppercase tracking-[0.16em] text-gold">Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ApptModal
          row={selected}
          onClose={() => setSelected(null)}
          onStatus={async (s) => { await updateFn({ data: { id: selected.id, status: s } }); await reload(); setSelected(null); }}
          onReschedule={async (starts_at) => { await reschedFn({ data: { id: selected.id, starts_at } }); await reload(); setSelected(null); }}
          onFee={async (kind) => { const r = await feeFn({ data: { id: selected.id, kind } }); await reload(); setSelected(null); return r; }}
        />
      )}
    </div>
  );
}

function ApptModal({ row, onClose, onStatus, onReschedule, onFee }: {
  row: Row; onClose: () => void;
  onStatus: (s: typeof STATUSES[number]) => Promise<void>;
  onReschedule: (starts_at: string) => Promise<void>;
  onFee: (kind: "cancel" | "no_show") => Promise<{ charged_cents: number; fee_cents: number; charge_error: string | null }>;
}) {
  const local = new Date(row.starts_at);
  const iso = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [when, setWhen] = useState(iso);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function wrap(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-sm border border-white/10 bg-ink p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="eyebrow">Appointment</div>
            <h2 className="mt-2 font-display text-2xl">{row.customers?.first_name} {row.customers?.last_name}</h2>
            <div className="mt-1 text-xs text-cream/60">{row.customers?.email} · {row.customers?.phone}</div>
          </div>
          <button onClick={onClose} className="text-cream/60 hover:text-gold">✕</button>
        </div>

        <div className="mt-6 space-y-2 text-sm">
          <div><span className="text-cream/50">Service:</span> {row.services?.name}</div>
          <div><span className="text-cream/50">Barber:</span> {row.barbers?.name ?? "No preference"}</div>
          <div><span className="text-cream/50">Location:</span> {row.locations?.name}</div>
          <div><span className="text-cream/50">Duration:</span> {row.duration_min} min</div>
          <div><span className="text-cream/50">Price:</span> ${((row.price_cents ?? 0) / 100).toFixed(2)}</div>
          {row.notes && <div><span className="text-cream/50">Notes:</span> {row.notes}</div>}
        </div>

        <div className="mt-6">
          <label className="block text-[10px] uppercase tracking-[0.24em] text-cream/60">Reschedule</label>
          <div className="mt-2 flex gap-2">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="flex-1 rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-sm" />
            <button disabled={busy} onClick={() => wrap(() => onReschedule(new Date(when).toISOString()))} className="btn-gold disabled:opacity-40">Save</button>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-[10px] uppercase tracking-[0.24em] text-cream/60">Status</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button key={s} disabled={busy} onClick={() => wrap(() => onStatus(s))} className="rounded-sm border border-white/15 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.16em] hover:border-gold hover:text-gold disabled:opacity-40">
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-[10px] uppercase tracking-[0.24em] text-cream/60">Charge Fee & Close</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => wrap(async () => { const r = await onFee("cancel"); if (r.charge_error) throw new Error(r.charge_error); })} className="rounded-sm border border-white/15 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.16em] hover:border-gold hover:text-gold disabled:opacity-40">
              Cancel w/ Late Fee
            </button>
            <button disabled={busy} onClick={() => wrap(async () => { const r = await onFee("no_show"); if (r.charge_error) throw new Error(r.charge_error); })} className="rounded-sm border border-white/15 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.16em] hover:border-gold hover:text-gold disabled:opacity-40">
              Mark No-Show w/ Fee
            </button>
          </div>
          <p className="mt-2 text-[11px] text-cream/40">Charges the card on file using the fees configured in Settings. Zero fee = no charge.</p>
        </div>

        {err && <div className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}
      </div>
    </div>
  );
}
