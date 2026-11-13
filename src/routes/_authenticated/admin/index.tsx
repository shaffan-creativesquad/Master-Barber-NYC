import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getAdminDashboard } from "@/lib/admin.functions";
import { getUpcomingBilling, getCashDue } from "@/lib/members.functions";
import { migrateMembershipPrices } from "@/lib/price-migration.functions";
import { BILLING_DAY_CHANGE_AT } from "@/lib/billing-proration";
import { Loader2, Calendar, DollarSign, Users, Clock, Repeat, Banknote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard | Admin | Master Barber NYC" },
      { name: "description", content: "Admin dashboard for Master Barber NYC staff." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type Data = Awaited<ReturnType<typeof getAdminDashboard>>;

type Billing = Awaited<ReturnType<typeof getUpcomingBilling>>["rows"];

type Cash = Awaited<ReturnType<typeof getCashDue>>["rows"];

function Dashboard() {
  const fn = useServerFn(getAdminDashboard);
  const billingFn = useServerFn(getUpcomingBilling);
  const cashFn = useServerFn(getCashDue);
  const [data, setData] = useState<Data | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [cash, setCash] = useState<Cash | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fn().then(setData).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    billingFn().then((r) => setBilling(r.rows)).catch(() => setBilling([]));
    cashFn().then((r) => setCash(r.rows)).catch(() => setCash([]));
  }, [fn, billingFn, cashFn]);

  if (err) return <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-4 text-red-200">{err}</div>;
  if (!data) return <div className="flex items-center gap-3 text-cream/60"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Overview</div>
          <h1 className="mt-2 font-display text-3xl">Dashboard</h1>
        </div>
        <Link to="/book" className="btn-gold">New booking</Link>
      </div>

      <PriceIncreaseCard />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Calendar />} label="Today's appointments" value={data.today.length} />
        <Stat icon={<DollarSign />} label="Today's revenue" value={`$${(data.revenue_today_cents / 100).toFixed(2)}`} />
        <Stat icon={<Users />} label="Total bookings" value={data.total} />
        <Stat icon={<Clock />} label="Pending requests" value={data.pending.length} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Today's schedule">
          {data.today.length === 0 ? (
            <Empty>No appointments today.</Empty>
          ) : data.today.map((a) => (
            <Row key={a.id}
              left={new Date(a.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              main={`${a.customers?.first_name ?? ""} ${a.customers?.last_name ?? ""}`.trim() || "Guest"}
              sub={`${a.services?.name} · ${a.barbers?.name ?? "Any"} · ${a.locations?.name}`}
              status={a.status as string}
            />
          ))}
        </Panel>

        <Panel title="Upcoming">
          {data.upcoming.length === 0 ? <Empty>Nothing on the books.</Empty> : data.upcoming.map((a) => (
            <Row key={a.id}
              left={new Date(a.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              main={`${a.customers?.first_name ?? ""} ${a.customers?.last_name ?? ""}`.trim() || "Guest"}
              sub={`${a.services?.name} · ${a.barbers?.name ?? "Any"} · ${new Date(a.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
              status={a.status as string}
            />
          ))}
        </Panel>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Membership billing · auto-renews on each member's billing day">
          {!billing ? (
            <div className="flex items-center gap-2 py-6 text-sm text-cream/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : billing.length === 0 ? (
            <Empty>No auto-billing memberships yet. Online signups and plans set up from a member's detail card appear here.</Empty>
          ) : billing.map((b) => (
            <div key={b.id} className="flex items-center gap-4 py-3">
              <div className="w-24 shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-cream/50">
                {b.next_billing_at
                  ? new Date(b.next_billing_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : "—"}
              </div>
              <div className="flex-1">
                <div className="text-sm text-cream">{b.name}</div>
                <div className="text-xs text-cream/50">
                  {b.plan_name} · {b.interval === "year" ? "annual" : "monthly"}
                  {b.status === "past_due" && <span className="ml-2 text-red-300">past due</span>}
                </div>
              </div>
              <div className="font-numeric text-sm text-gold">
                {b.amount_cents != null ? `$${(b.amount_cents / 100).toFixed(2)}` : "—"}
              </div>
              <Repeat className="h-3.5 w-3.5 text-cream/30" />
            </div>
          ))}
        </Panel>

        <Panel title="Cash payments pending · due on each member's billing day">
          {!cash ? (
            <div className="flex items-center gap-2 py-6 text-sm text-cream/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : cash.length === 0 ? (
            <Empty>No cash payments outstanding.</Empty>
          ) : (
            <>
              <div className="py-3 text-sm text-amber-200">
                {cash.length} member{cash.length === 1 ? "" : "s"} to remind: “Please settle your payment.”
              </div>
              {cash.map((b) => (
                <div key={b.id} className="flex items-center gap-4 py-3">
                  <div className="w-24 shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/80">
                    {b.due_on ? new Date(b.due_on).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-cream">{b.name}</div>
                    <div className="text-xs text-cream/50">{b.plan_name} · payment pending</div>
                  </div>
                  <div className="font-numeric text-sm text-gold">
                    {b.amount_cents != null ? `$${(b.amount_cents / 100).toFixed(2)}` : "—"}
                  </div>
                  <Banknote className="h-3.5 w-3.5 text-cream/30" />
                </div>
              ))}
              <div className="pt-3 text-xs text-cream/50">
                Open the member on the Members page and use “Mark as paid” once the cash is taken.
              </div>
            </>
          )}
        </Panel>
      </div>

    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center gap-3 text-gold">{icon}</div>
      <div className="mt-4 text-[10px] uppercase tracking-[0.24em] text-cream/50">{label}</div>
      <div className="mt-1 font-display text-3xl">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] p-6">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-4 divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Row({ left, main, sub, status }: { left: string; main: string; sub: string; status: string }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="w-20 shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-cream/50">{left}</div>
      <div className="flex-1">
        <div className="text-sm text-cream">{main}</div>
        <div className="text-xs text-cream/50">{sub}</div>
      </div>
      <StatusPill status={status} />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-sm text-cream/50">{children}</div>;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    checked_in: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    completed: "bg-white/10 text-cream/70 border-white/20",
    cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
    no_show: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  return <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${map[status] ?? "bg-white/5 border-white/10 text-cream/60"}`}>{status.replace("_", " ")}</span>;
}

function PriceIncreaseCard() {
  const run = useServerFn(migrateMembershipPrices);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Awaited<ReturnType<typeof migrateMembershipPrices>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const tooEarly = Date.now() < BILLING_DAY_CHANGE_AT.getTime();

  async function go() {
    if (!confirm("Move every auto-billing member to the new prices at their next billing date?")) return;
    setBusy(true); setErr(null);
    try { setRes(await run()); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  return (
    <div className="mt-8 rounded-sm border border-gold/30 bg-gold/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl text-sm text-cream/75">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold">Nov 1 price increase</div>
          <p className="mt-1">
            Moves existing auto-billing members to the new prices (Bronze $59.99, Silver $120, Gold $150) starting
            with their next billing date. Safe to run more than once.
          </p>
          {tooEarly && (
            <p className="mt-1 text-xs text-cream/50">
              Available from November 1, 2026. Running it earlier would charge the new price on October 10.
            </p>
          )}
          <p className="mt-1 text-xs text-cream/50">
            Members whose membership hadn't started yet are skipped. Run this again after Nov 10 to move them to the new price.
          </p>
        </div>
        <button onClick={go} disabled={busy || tooEarly} className="btn-gold disabled:opacity-40">
          {busy ? "Applying…" : "Apply Nov 1 price increase"}
        </button>
      </div>
      {err && <div className="mt-3 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}
      {res && (
        <div className="mt-3 text-sm text-cream/80">
          Swapped {res.swapped} · Skipped {res.skipped} · Failed {res.failed}
          {res.failures.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-red-200">
              {res.failures.map((f) => <li key={f.membership_id}>{f.membership_id}: {f.error}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
