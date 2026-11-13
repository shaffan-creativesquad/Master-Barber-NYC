import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getAdminConfig, upsertService, deleteService } from "@/lib/admin.functions";
import { Loader2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/services")({
  head: () => ({
    meta: [
      { title: "Services | Admin | Master Barber NYC" },
      { name: "description", content: "Manage the service menu for Master Barber NYC." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ServicesPage,
});

type Service = {
  id?: string; name: string; description: string | null; price_cents: number;
  duration_min: number; buffer_min: number; category: string; active: boolean; sort_order: number;
};

const EMPTY: Service = { name: "", description: "", price_cents: 4200, duration_min: 45, buffer_min: 0, category: "haircut", active: true, sort_order: 100 };

function ServicesPage() {
  const cfgFn = useServerFn(getAdminConfig);
  const saveFn = useServerFn(upsertService);
  const delFn = useServerFn(deleteService);
  const [rows, setRows] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Service | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    const c = await cfgFn();
    setRows(c.services as Service[]);
    setBusy(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!editing) return;
    setErr(null);
    try {
      await saveFn({ data: {
        id: editing.id, name: editing.name, description: editing.description || null,
        price_cents: Number(editing.price_cents), duration_min: Number(editing.duration_min),
        buffer_min: Number(editing.buffer_min ?? 0),
        category: editing.category, active: editing.active, sort_order: Number(editing.sort_order),
      } });
      setEditing(null); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Catalog</div>
          <h1 className="mt-2 font-display text-3xl">Services</h1>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-gold"><Plus className="mr-2 inline h-4 w-4" />New service</button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-sm border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-[10px] uppercase tracking-[0.16em] text-cream/50">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Active</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {busy && <tr><td colSpan={6} className="px-4 py-6 text-center text-cream/50"><Loader2 className="inline h-4 w-4 animate-spin" /></td></tr>}
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-white/5">
                <td className="px-4 py-3">{s.name}<div className="text-xs text-cream/50">{s.description}</div></td>
                <td className="px-4 py-3 capitalize">{s.category}</td>
                <td className="px-4 py-3">{s.duration_min} min</td>
                <td className="px-4 py-3">${(s.price_cents / 100).toFixed(2)}</td>
                <td className="px-4 py-3">{s.active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing({ ...s })} className="text-xs uppercase tracking-[0.16em] text-gold">Edit</button>
                  {s.active && s.id && <button onClick={async () => { if (confirm("Deactivate this service?")) { await delFn({ data: { id: s.id! } }); await load(); } }} className="ml-3 text-xs uppercase tracking-[0.16em] text-red-300">Deactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-sm border border-white/10 bg-ink p-8">
            <div className="flex items-start justify-between">
              <h2 className="font-display text-2xl">{editing.id ? "Edit service" : "New service"}</h2>
              <button onClick={() => setEditing(null)} className="text-cream/60 hover:text-gold">✕</button>
            </div>
            <div className="mt-6 grid gap-4">
              <F label="Name"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={input} /></F>
              <F label="Description"><textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={input} rows={3} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Price (dollars)"><input type="number" min={0} step="0.01" value={(editing.price_cents / 100).toFixed(2)} onChange={(e) => setEditing({ ...editing, price_cents: Math.round(Number(e.target.value) * 100) })} className={input} /></F>
                <F label="Sort"><input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={input} /></F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Duration (min)"><input type="number" value={editing.duration_min} onChange={(e) => setEditing({ ...editing, duration_min: Number(e.target.value) })} className={input} /></F>
                <F label="Cleanup buffer (min)"><input type="number" min={0} max={60} value={editing.buffer_min ?? 0} onChange={(e) => setEditing({ ...editing, buffer_min: Number(e.target.value) })} className={input} /></F>
              </div>
              <F label="Category"><input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={input} /></F>
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
    </div>
  );
}

const input = "w-full rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-sm";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/60">{label}</span><div className="mt-2">{children}</div></label>;
}
