import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getAdminConfig, updateSettings, addHoliday, removeHoliday } from "@/lib/admin.functions";
import { Loader2, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings | Admin | Master Barber NYC" },
      { name: "description", content: "Manage business settings for Master Barber NYC." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

type Settings = {
  require_card: boolean; require_deposit: boolean; deposit_cents: number;
  cancellation_window_hours: number; cancellation_fee_cents: number; no_show_fee_cents: number;
  auto_confirm: boolean; max_days_ahead: number;
};
type Holiday = { id: string; date: string; reason: string | null; location_id: string | null };
type Loc = { id: string; name: string };

function SettingsPage() {
  const cfgFn = useServerFn(getAdminConfig);
  const saveFn = useServerFn(updateSettings);
  const addFn = useServerFn(addHoliday);
  const rmFn = useServerFn(removeHoliday);
  const [s, setS] = useState<Settings | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newLoc, setNewLoc] = useState("");

  async function load() {
    setBusy(true);
    const c = await cfgFn();
    setS(c.settings as Settings);
    setHolidays(c.holidays as Holiday[]);
    setLocations(c.locations.map((l) => ({ id: l.id, name: l.name })));
    setBusy(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!s) return;
    setErr(null); setMsg(null);
    try {
      await saveFn({ data: {
        require_card: s.require_card, require_deposit: s.require_deposit, deposit_cents: Number(s.deposit_cents),
        cancellation_window_hours: Number(s.cancellation_window_hours), cancellation_fee_cents: Number(s.cancellation_fee_cents),
        no_show_fee_cents: Number(s.no_show_fee_cents), auto_confirm: s.auto_confirm, max_days_ahead: Number(s.max_days_ahead),
      } });
      setMsg("Saved.");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  async function addH() {
    if (!newDate) return;
    await addFn({ data: { date: newDate, reason: newReason || undefined, location_id: newLoc || null } });
    setNewDate(""); setNewReason(""); setNewLoc("");
    await load();
  }

  if (busy || !s) return <div className="text-cream/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div>
      <div className="eyebrow">Configuration</div>
      <h1 className="mt-2 font-display text-3xl">Booking policies</h1>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Panel title="Payment & holds">
          <Toggle label="Require card on file" checked={s.require_card} onChange={(v) => setS({ ...s, require_card: v })} />
          <Toggle label="Require deposit" checked={s.require_deposit} onChange={(v) => setS({ ...s, require_deposit: v })} />
          <Num label="Deposit amount (cents)" value={s.deposit_cents} onChange={(v) => setS({ ...s, deposit_cents: v })} />
        </Panel>
        <Panel title="Cancellation">
          <Num label="Cancellation window (hours)" value={s.cancellation_window_hours} onChange={(v) => setS({ ...s, cancellation_window_hours: v })} />
          <Num label="Cancellation fee (cents)" value={s.cancellation_fee_cents} onChange={(v) => setS({ ...s, cancellation_fee_cents: v })} />
          <Num label="No-show fee (cents)" value={s.no_show_fee_cents} onChange={(v) => setS({ ...s, no_show_fee_cents: v })} />
        </Panel>
        <Panel title="Booking">
          <Toggle label="Auto-confirm bookings" checked={s.auto_confirm} onChange={(v) => setS({ ...s, auto_confirm: v })} />
          <Num label="Max days ahead" value={s.max_days_ahead} onChange={(v) => setS({ ...s, max_days_ahead: v })} />
        </Panel>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} className="btn-gold">Save settings</button>
        {msg && <span className="text-sm text-gold">{msg}</span>}
        {err && <span className="text-sm text-red-300">{err}</span>}
      </div>

      <div className="mt-12">
        <h2 className="font-display text-2xl">Holidays & closures</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-sm border border-white/10 bg-white/[0.02] p-4">
          <F label="Date"><input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={input} /></F>
          <F label="Reason"><input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Holiday" className={input} /></F>
          <F label="Location">
            <select value={newLoc} onChange={(e) => setNewLoc(e.target.value)} className={input}>
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </F>
          <button onClick={addH} className="btn-gold h-10"><Plus className="mr-2 inline h-4 w-4" /> Add</button>
        </div>

        <div className="mt-4 divide-y divide-white/5 rounded-sm border border-white/10">
          {holidays.length === 0 && <div className="p-6 text-center text-sm text-cream/50">No holidays configured.</div>}
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="font-medium">{h.date}</span>
                {h.reason && <span className="ml-3 text-cream/60">{h.reason}</span>}
                <span className="ml-3 text-xs text-cream/50">{h.location_id ? (locations.find((l) => l.id === h.location_id)?.name ?? "Location") : "All locations"}</span>
              </div>
              <button onClick={async () => { await rmFn({ data: { id: h.id } }); await load(); }} className="text-cream/60 hover:text-red-300"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-sm border border-white/10 bg-white/[0.02] p-6"><h2 className="font-display text-xl">{title}</h2><div className="mt-4 space-y-4">{children}</div></div>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center justify-between text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
}
function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <label className="flex items-center justify-between gap-4 text-sm"><span>{label}</span><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-32 rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-right text-sm" /></label>;
}
const input = "rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-sm";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/60">{label}</span><div className="mt-2">{children}</div></label>;
}
