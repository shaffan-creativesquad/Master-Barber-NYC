import { billingDayLabel, billingDayForNewMembership } from "@/lib/billing-proration";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import {
  listMemberships, getExpiringMemberships, getCheckinHistory,
  addManualMembership, updateMembership, ensureMemberCode, updateCustomerDetails,
  isMembershipValid, overrideMembershipExpiration, expirationEditsOpen, getMemberPanel,
  startNewMemberAutoBilling, deleteMember, bulkDeleteMembers, cashPaymentDue, markCashPaid, previewPlanBilling, getReceiptPhotoUrl,
  sendBillingSetupInvite, sendBillingSetupInviteBulk, changeMembershipPlan, setMembershipTip, removeDuplicateMembership,
  cancelMembership, getMembershipRefundInfo, listMemberPayments, refundPayment,
  EXPIRATION_EDIT_LIMIT, EXPIRATION_EDIT_WINDOW_DAYS,
} from "@/lib/members.functions";
import { getIsAdmin } from "@/lib/admin.functions";
import { getSquareConfig } from "@/lib/square.functions";
import { SquareCardForm } from "@/components/square-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TipPicker } from "@/components/tip-picker";

import { ApprovedPanel, DeniedPanel, ExpiredPanel, RenewFlow, ResubscribeFlow, ReceiptCapture, MemberPhoto, type PanelResult, formatMembershipDate } from "@/components/member-panel";
import { getMemberships, type Membership } from "@/lib/site-data";
import { Check, Loader2, Plus, X, CreditCard, History, Pencil, Banknote, ChevronLeft, Trash2, Repeat, Search, ArrowUpDown, ArrowUp, ArrowDown, Mail, HandCoins, Ban, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/validator/members")({
  head: () => ({
    meta: [
      { title: "Members | Admin | Master Barber NYC" },
      { name: "description", content: "Membership ledger, expirations and member cards for Master Barber NYC." },
      { property: "og:title", content: "Members | Admin | Master Barber NYC" },
      { property: "og:description", content: "Membership ledger and renewal dates for Master Barber NYC staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MembersPage,
});

type Row = Awaited<ReturnType<typeof listMemberships>>["rows"][number];


const STATUSES = ["active", "past_due", "canceled", "incomplete"] as const;

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function isExpired(d: string | null) {
  return !!d && new Date(d).getTime() < Date.now();
}

function needsBillingUpdate(r: Row) {
  return !r.square_subscription_id || !r.square_card_id;
}

/** Still needs a card AND has never been emailed the setup link. */
function notYetInvited(r: Row) {
  return needsBillingUpdate(r) && !r.billing_invite_sent_at;
}


/** Opens a short-lived signed link to a cash renewal's receipt photo. */
function ReceiptLink({ path }: { path: string }) {
  const urlFn = useServerFn(getReceiptPhotoUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-block">
        <img src={url} alt="Cash receipt" className="h-16 w-16 rounded-sm border border-white/10 object-cover" />
      </a>
    );
  }
  return (
    <button type="button" disabled={busy}
      onClick={async () => { setBusy(true); try { setUrl((await urlFn({ data: { path } })).url); } catch { /* ignore */ } setBusy(false); }}
      className="mt-1 text-xs text-gold underline-offset-2 hover:underline disabled:opacity-50">
      {busy ? "Opening…" : "View receipt"}
    </button>
  );
}

function Barcode({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, code, { format: "CODE128", displayValue: true, height: 80, fontSize: 16, margin: 8 });
    }
  }, [code]);
  return <svg ref={ref} className="mx-auto w-full max-w-sm bg-white p-2" />;
}

/** Sortable table header cell. */
function SortTh({ label, k, sort, onSort }: {
  label: string;
  k: "name" | "tier" | "status" | "renews" | "visits";
  sort: { key: string; dir: "asc" | "desc" };
  onSort: (k: "name" | "tier" | "status" | "renews" | "visits") => void;
}) {
  const active = sort.key === k;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className="px-4 py-3">
      <button type="button" onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.16em] transition hover:text-gold ${active ? "text-gold" : ""}`}>
        {label}<Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function MembersPage() {
  const listFn = useServerFn(listMemberships);
  const expFn = useServerFn(getExpiringMemberships);
  const histFn = useServerFn(getCheckinHistory);
  
  const addFn = useServerFn(addManualMembership);
  const updateFn = useServerFn(updateMembership);
  const overrideFn = useServerFn(overrideMembershipExpiration);
  const codeFn = useServerFn(ensureMemberCode);
  const editCustomerFn = useServerFn(updateCustomerDetails);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [tipFor, setTipFor] = useState<Row | null>(null);
  const [tipCents, setTipCents] = useState(0);
  const [tipBusy, setTipBusy] = useState(false);


  const [rows, setRows] = useState<Row[]>([]);
  const [expiring, setExpiring] = useState<Awaited<ReturnType<typeof getExpiringMemberships>> | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getCheckinHistory>> | null>(null);
  const [card, setCard] = useState<{ code: string; name: string } | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: "name" | "tier" | "status" | "renews" | "visits"; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [removingDup, setRemovingDup] = useState<Row | null>(null);
  const [canceling, setCanceling] = useState<Row | null>(null);
  const [refunding, setRefunding] = useState<Row | null>(null);
  const isAdminFn = useServerFn(getIsAdmin);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    isAdminFn().then((r) => setIsAdmin(!!r.isAdmin)).catch(() => setIsAdmin(false));
  }, [isAdminFn]);
  const rowsPerCustomer = new Map<string, number>();
  for (const r of rows) rowsPerCustomer.set(r.customer_id, (rowsPerCustomer.get(r.customer_id) ?? 0) + 1);
  const inviteFn = useServerFn(sendBillingSetupInvite);
  const tipFn = useServerFn(setMembershipTip);
  const inviteBulkFn = useServerFn(sendBillingSetupInviteBulk);
  const [inviting, setInviting] = useState<string | null>(null);
  const [bulkInviting, setBulkInviting] = useState(false);

  async function sendInvite(customerId: string) {
    setErr(null); setSuccess(null); setInviting(customerId);
    try {
      const res = await inviteFn({ data: { customer_id: customerId } });
      setSuccess(`Billing setup link emailed to ${res.email}.`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setInviting(null);
    await load();
  }

  async function sendInviteBulk() {
    setErr(null); setSuccess(null); setBulkInviting(true);
    const ids = [...selected];
    const BATCH = 5;
    let sent = 0, failed = 0;
    let firstIssue: { email: string | null; error: string } | null = null;
    const failedIds = new Set<string>();
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        const res = await inviteBulkFn({ data: { customer_ids: chunk } });
        sent += res.sent; failed += res.failed;
        for (const id of res.failed_ids) failedIds.add(id);
        const notProcessed = ids.slice(i + BATCH);
        setSelected(new Set([...failedIds, ...notProcessed]));
        if (!firstIssue && res.failures[0]) firstIssue = res.failures[0];
        setSuccess(`Sending… ${Math.min(i + BATCH, ids.length)} of ${ids.length} processed.`);
        if (res.rate_limited) {
          const seconds = Math.max(60, res.retry_after_seconds);
          setSuccess(`Email service paused sending. Continuing in ${seconds} seconds…`);
          await new Promise((resolve) => window.setTimeout(resolve, seconds * 1000));
        } else if (i + BATCH < ids.length) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }
      setSuccess(`Emailed ${sent} member${sent === 1 ? "" : "s"}.${failed ? ` ${failed} remain selected for retry.` : ""}`);
      if (firstIssue && failedIds.size > 0) setErr(`Example issue: ${firstIssue.email ?? "unknown"} — ${firstIssue.error}`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBulkInviting(false);
    await load();
  }

  function toggleSelect(customerId: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(customerId)) next.delete(customerId); else next.add(customerId);
      return next;
    });
  }

  function toggleSort(key: typeof sort.key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (!q) return true;
    const c = r.customers as { first_name: string; last_name: string; email: string; phone: string; member_code: string | null } | null;
    return [c?.first_name, c?.last_name, c ? `${c.first_name} ${c.last_name}` : "", c?.email, c?.phone, c?.member_code, r.tier]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });
  const sorted = [...filtered].sort((a, b) => {
    const ca = a.customers as { first_name: string; last_name: string } | null;
    const cb = b.customers as { first_name: string; last_name: string } | null;
    let cmp = 0;
    if (sort.key === "name") cmp = `${ca?.first_name ?? ""} ${ca?.last_name ?? ""}`.localeCompare(`${cb?.first_name ?? ""} ${cb?.last_name ?? ""}`);
    else if (sort.key === "tier") cmp = a.tier.localeCompare(b.tier);
    else if (sort.key === "status") cmp = a.status.localeCompare(b.status);
    else if (sort.key === "renews") cmp = (a.current_period_end ?? "").localeCompare(b.current_period_end ?? "");
    else if (sort.key === "visits") cmp = (a.visit_count ?? 0) - (b.visit_count ?? 0);
    return sort.dir === "asc" ? cmp : -cmp;
  });

  async function load() {
    setBusy(true);
    try {
      const [l, e] = await Promise.all([listFn(), expFn()]);
      setRows(l.rows as Row[]);
      setExpiring(e);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);



  return (
    <div className="w-full max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Members Club</div>
          <h1 className="mt-2 font-display text-3xl">Members</h1>
        </div>
        <button onClick={() => setAdding(true)} className="btn-gold"><Plus className="mr-2 inline h-4 w-4" />Add membership</button>
      </div>

      {err && <div className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}
      {success && (
        <div role="status" className="mt-4 flex items-center gap-2 rounded-sm border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <Check className="h-4 w-4" /> {success}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total memberships" value={rows.length} />
        <Stat label="Active" value={rows.filter((r) => isMembershipValid(r)).length} />
        <Stat label="Payment info needed" value={rows.filter(needsBillingUpdate).length} />
        <Stat label="Not yet invited" value={rows.filter(notYetInvited).length} />
      </div>

      {busy ? (
        <div className="mt-10 flex items-center gap-2 text-cream/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, phone, code…"
                className="w-full rounded-sm border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-cream placeholder:text-cream/30 focus:border-gold/50 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelected(new Set(filtered.filter(notYetInvited).map((r) => r.customer_id)))}
              className="inline-flex items-center gap-1.5 rounded-sm border border-gold/60 bg-gold/15 px-3 py-2 text-xs uppercase tracking-[0.16em] text-gold transition hover:bg-gold/25"
            >
              <Mail className="h-3.5 w-3.5" /> Select all not yet invited
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set(filtered.filter(needsBillingUpdate).map((r) => r.customer_id)))}
              className="inline-flex items-center gap-1.5 rounded-sm border border-white/20 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-cream/80 transition hover:bg-white/10"
            >
              <CreditCard className="h-3.5 w-3.5" /> Select all needing payment info
            </button>
          </div>
          {selected.size > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-sm border border-white/15 bg-white/5 px-4 py-2 text-sm">
              <span className="text-cream/80">{selected.size} selected</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-cream/60 hover:text-cream">Clear</button>
                <button type="button" onClick={sendInviteBulk} disabled={bulkInviting}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-gold/60 bg-gold/15 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-gold transition hover:bg-gold/25 disabled:opacity-50">
                  {bulkInviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Email billing setup link
                </button>
                <button type="button" onClick={() => setBulkDeleting(true)}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-red-500/60 bg-red-600/80 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-white transition hover:bg-red-600">
                  <Trash2 className="h-3.5 w-3.5" /> Delete selected
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 overflow-x-auto rounded-sm border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-[10px] uppercase tracking-[0.16em] text-cream/50">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" aria-label="Select all"
                      checked={sorted.length > 0 && sorted.every((r) => selected.has(r.customer_id))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(sorted.map((r) => r.customer_id)) : new Set())}
                      className="h-4 w-4 accent-red-500" />
                  </th>
                  <SortTh label="Member" k="name" sort={sort} onSort={toggleSort} /><th className="px-4 py-3">Code</th><SortTh label="Tier" k="tier" sort={sort} onSort={toggleSort} />
                   <SortTh label="Status" k="status" sort={sort} onSort={toggleSort} /><th className="px-4 py-3">Billing</th><SortTh label="Renews / ends" k="renews" sort={sort} onSort={toggleSort} /><SortTh label="Visits" k="visits" sort={sort} onSort={toggleSort} /><th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const c = r.customers as { first_name: string; last_name: string; email: string; phone: string; member_code: string | null } | null;
                  return (
                     <tr key={r.id} className={`border-t border-white/5 ${selected.has(r.customer_id) ? "bg-red-500/5" : ""}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" aria-label={`Select ${c ? `${c.first_name} ${c.last_name}` : "member"}`}
                          checked={selected.has(r.customer_id)}
                          onChange={() => toggleSelect(r.customer_id)}
                          className="h-4 w-4 accent-red-500" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <MemberPhoto url={(r as { photo_url?: string | null }).photo_url ?? null}
                            name={c ? `${c.first_name} ${c.last_name}` : null} editable={false} size={40} />
                          <div>
                        <button
                          type="button"
                          onClick={() => setDetail(r)}
                          className="text-left text-cream underline-offset-4 transition hover:text-gold hover:underline"
                        >
                          {c ? `${c.first_name} ${c.last_name}` : "—"}
                        </button>
                        <div className="text-xs text-cream/40">{c?.email}</div>
                        {c?.phone ? (
                          <div className="text-xs text-cream/40">{c.phone}</div>
                        ) : (
                          <div className="text-xs text-amber-200/80">No phone on file</div>
                        )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-numeric tracking-widest text-cream/70">{c?.member_code ?? "—"}</td>
                      <td className="px-4 py-3">{r.tier}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-sm border border-white/15 bg-black/40 px-2 py-0.5 text-xs uppercase tracking-[0.16em] text-cream">
                          {r.status}
                        </span>
                        {r.status === "active" && !isMembershipValid(r) && (
                          <div className="mt-1 inline-block rounded-sm border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-gold">
                            Expired
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {needsBillingUpdate(r) ? (
                          <span className="inline-flex items-center gap-1 rounded-sm border border-amber-400/50 bg-amber-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-200">
                            <CreditCard className="h-3 w-3" /> Update needed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                            <Check className="h-3 w-3" /> Card ready
                          </span>
                        )}
                        {needsBillingUpdate(r) && (
                          <div className="mt-1">
                            {r.billing_invite_sent_at ? (
                              <span
                                title={`Billing link emailed ${new Date(r.billing_invite_sent_at).toLocaleString()}`}
                                className="inline-flex items-center gap-1 rounded-sm border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-sky-200"
                              >
                                <Mail className="h-3 w-3" /> Invited {fmt(r.billing_invite_sent_at)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-sm border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cream/60">
                                Not invited
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className={`px-4 py-3 ${!r.needs_review && r.current_period_end && isExpired(r.current_period_end) ? "text-gold" : ""}`}>
                        {!needsBillingUpdate(r) && (
                          <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-emerald-300">
                            <Repeat className="h-3 w-3" /> Auto · {billingDayLabel(r.billing_day)}
                          </span>
                        )}
                        {cashPaymentDue(r) && (
                          <span className="mb-1 block w-fit rounded-full border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
                            Payment pending
                          </span>
                        )}
                        {(() => {
                          const dateInfo = formatMembershipDate(r);
                          return dateInfo.date || r.status === "canceled" ? (
                            <div>{dateInfo.full}</div>
                          ) : (
                            <span className="inline-block rounded-full border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
                              Needs review
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 font-numeric text-cream/70">{r.visit_count}</td>
                      <td className="px-4 py-3 text-right">
                        {needsBillingUpdate(r) && (
                          <button
                            onClick={() => sendInvite(r.customer_id)}
                            disabled={inviting === r.customer_id}
                            title="Email this member a secure link to add their card"
                            className="mr-3 text-xs text-gold/80 hover:text-gold disabled:opacity-50"
                          >
                            {inviting === r.customer_id
                              ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                              : <Mail className="mr-1 inline h-3.5 w-3.5" />}
                            Billing link
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(toEditTarget(r))}
                          className="mr-3 text-xs text-cream/60 hover:text-gold"
                        ><Pencil className="mr-1 inline h-3.5 w-3.5" />Edit</button>

                        <button
                          onClick={() => { setTipFor(r); setTipCents(r.tip_cents ?? 0); }}
                          title="Set a recurring monthly tip charged with each membership payment"
                          className="mr-3 text-xs text-cream/60 hover:text-gold"
                        ><HandCoins className="mr-1 inline h-3.5 w-3.5" />Tip{(r.tip_cents ?? 0) > 0 ? ` $${((r.tip_cents ?? 0) / 100).toFixed(0)}` : ""}</button>

                        <button
                          onClick={async () => setHistory(await histFn({ data: { customer_id: r.customer_id } }))}
                          className="mr-3 text-xs text-cream/60 hover:text-gold"
                        ><History className="mr-1 inline h-3.5 w-3.5" />History</button>
                        <button
                          onClick={async () => {
                            const res = await codeFn({ data: { customer_id: r.customer_id } });
                            setCard({ code: res.member_code, name: res.name });
                          }}
                          className="text-xs text-cream/60 hover:text-gold"
                        ><CreditCard className="mr-1 inline h-3.5 w-3.5" />Card</button>
                        {(rowsPerCustomer.get(r.customer_id) ?? 0) > 1 && (
                          <button
                            onClick={() => setRemovingDup(r)}
                            title="This customer has more than one membership row"
                            className="ml-3 text-xs text-red-300/80 hover:text-red-300"
                          ><Trash2 className="mr-1 inline h-3.5 w-3.5" />Remove duplicate</button>
                        )}
                        {isAdmin && r.status !== "canceled" && (
                          <button
                            onClick={() => setCanceling(r)}
                            title="Stop card billing; the member keeps access until their paid period ends"
                            className="ml-3 text-xs text-red-300/80 hover:text-red-300"
                          ><Ban className="mr-1 inline h-3.5 w-3.5" />Cancel membership</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-cream/50">{rows.length === 0 ? "No memberships yet." : "No members match your search."}</td></tr>}
              </tbody>
            </table>
          </div>

          <h2 className="mt-12 font-display text-2xl">Expiring soon</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ExpiringCard title="Next 7 days" rows={expiring?.within7 ?? []} />
            <ExpiringCard title="Next 30 days" rows={expiring?.within30 ?? []} />
          </div>
        </>
      )}

      {adding && (
        <AddMembership
          onClose={() => setAdding(false)}
          onDone={async (name) => {
            setAdding(false);
            setQuery("");
            setSort({ key: "name", dir: "asc" });
            setSuccess(`${name} was added successfully.`);
            await load();
          }}
          addFn={addFn}
        />
      )}

      {detail && (
        <MemberDetail
          row={detail}
          isAdmin={isAdmin}
          onClose={() => setDetail(null)}
          onEdit={() => setEditing(toEditTarget(detail))}
          onChanged={load}
          onCancelMembership={() => { setCanceling(detail); setDetail(null); }}
          onRefundPayment={() => { setRefunding(detail); setDetail(null); }}
        />
      )}

      {editing && (
        <EditCustomer
          target={editing}
          onClose={() => setEditing(null)}
          onDone={async () => { setEditing(null); setDetail((d) => (d ? { ...d } : d)); await load(); }}
          saveFn={editCustomerFn}
          saveMembershipFn={updateFn}
          overrideFn={overrideFn}
        />
      )}

      {history && (
        <Modal onClose={() => setHistory(null)} title={`Check-in history · ${history.customer?.first_name ?? ""} ${history.customer?.last_name ?? ""}`}>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto text-sm">
            {history.rows.length === 0 && <div className="text-cream/50">No check-ins recorded.</div>}
            {history.rows.map((h) => (
              <div key={h.id} className="flex items-start justify-between gap-4 border-b border-white/5 pb-2">
                <div>
                  <span className={h.result === "approved" ? "text-emerald-300" : "text-red-300"}>{h.result}</span>
                  <span className="ml-2 text-xs uppercase tracking-widest text-cream/40">{h.matched_via}</span>
                  {h.reason && <div className="text-xs text-cream/50">{h.reason}</div>}
                  {h.receipt_photo_path && <ReceiptLink path={h.receipt_photo_path} />}
                </div>
                <div className="whitespace-nowrap text-xs text-cream/40">{new Date(h.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {tipFor && (
        <Modal
          onClose={() => setTipFor(null)}
          title={`Monthly tip · ${tipFor.customers?.first_name ?? ""} ${tipFor.customers?.last_name ?? ""}`}
        >
          <p className="mb-4 text-xs text-cream/55">
            Charged to the member's saved card each month, right after the membership payment on their billing day. Tips are never taxed.
            {!tipFor.square_card_id && (
              <span className="mt-2 block text-amber-200">
                This member has no card on file yet — the tip will start once they add one.
              </span>
            )}
          </p>
          <TipPicker
            baseCents={getMemberships().find((m) => m.id === tipFor.plan_id)?.amountCents ?? 5999}
            value={tipCents}
            onChange={setTipCents}
            percentLabel="Percent of the monthly plan price."
          />
          <button
            disabled={tipBusy}
            onClick={async () => {
              setTipBusy(true);
              try {
                await tipFn({ data: { membership_id: tipFor.id, tip_cents: tipCents } });
                setTipFor(null);
                await load();
              } finally {
                setTipBusy(false);
              }
            }}
            className="btn-gold mt-6 w-full disabled:opacity-50"
          >
            {tipBusy ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
            Save monthly tip
          </button>
        </Modal>
      )}

      {card && (
        <Modal onClose={() => setCard(null)} title={`Member card · ${card.name}`}>
          <Barcode code={card.code} />
          <p className="mt-4 text-center text-xs uppercase tracking-[0.24em] text-cream/50">Member code {card.code}</p>
          <button onClick={() => window.print()} className="btn-gold mt-6 w-full">Print card</button>
        </Modal>
      )}

      {bulkDeleting && (
        <BulkDelete
          rows={sorted.filter((r) => selected.has(r.customer_id))}
          onClose={() => setBulkDeleting(false)}
          onDone={async () => { setBulkDeleting(false); setSelected(new Set()); await load(); }}
        />
      )}

      {removingDup && (
        <RemoveDuplicate
          row={removingDup}
          onClose={() => setRemovingDup(null)}
          onDone={async () => { setRemovingDup(null); await load(); }}
        />
      )}

      {canceling && (
        <CancelMembership
          row={canceling}
          onClose={() => setCanceling(null)}
          onDone={async () => { setCanceling(null); await load(); }}
        />
      )}

      {refunding && (
        <RefundPayment
          row={refunding}
          onClose={() => setRefunding(null)}
          onDone={async () => { setRefunding(null); await load(); }}
        />
      )}
    </div>
  );
}

/** Cancel a membership: stops card billing; the member keeps access until period end. */
function CancelMembership({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => Promise<void> }) {
  const cancelFn = useServerFn(cancelMembership);
  const infoFn = useServerFn(getMembershipRefundInfo);
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getMembershipRefundInfo>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const payment = info?.payment;
  const remainder = payment ? payment.amount_cents - payment.refunded_cents : 0;
  const cents = mode === "full" ? remainder : Math.round(Number(amount) * 100);
  const validAmount = !refund || (Number.isFinite(cents) && cents > 0 && cents <= remainder);
  useEffect(() => {
    let active = true;
    infoFn({ data: { membership_id: row.id } }).then((v) => { if (active) setInfo(v); })
      .catch((e) => { if (active) setErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [infoFn, row.id]);

  async function submit() {
    if (busy || canceled) return;
    setBusy(true); setErr(null);
    try {
      const result = await cancelFn({ data: { membership_id: row.id, reason: reason.trim(),
        ...(refund && payment ? { refund: { payment_id: payment.payment_id, amount_cents: cents } } : {}),
      } });
      if (!result.ok) { setCanceled(true); setErr(result.error); }
      else await onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  return (
    <Modal onClose={busy ? () => {} : onClose} title="Cancel this membership?">
      <p className="text-sm text-muted-foreground">
        Square billing stops. Member keeps access until {row.current_period_end ? fmt(row.current_period_end) : "the end of their paid period"} unless refunded.
      </p>
      {loading ? <p className="mt-4 text-sm text-muted-foreground">Checking last card payment…</p> : payment && remainder > 0 ? (
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 text-sm"><Checkbox checked={refund} disabled={busy || canceled} onCheckedChange={(v) => setRefund(v === true)} />Also refund last card payment</label>
          {refund && <>
            <p className="text-sm">${(payment.amount_cents / 100).toFixed(2)} charged on {fmt(payment.date)}, {payment.brand.replaceAll("_", " ")} •••• {payment.last4}</p>
            {payment.refunded_cents > 0 && <p className="text-xs text-muted-foreground">Already refunded ${(payment.refunded_cents / 100).toFixed(2)} · Remaining ${(remainder / 100).toFixed(2)}</p>}
            <div role="group" aria-label="Refund amount" className="flex gap-2">
              <Button size="sm" variant={mode === "full" ? "default" : "outline"} aria-pressed={mode === "full"} disabled={busy || canceled} onClick={() => setMode("full")}>Full</Button>
              <Button size="sm" variant={mode === "partial" ? "default" : "outline"} aria-pressed={mode === "partial"} disabled={busy || canceled} onClick={() => setMode("partial")}>Partial</Button>
            </div>
            {mode === "partial" && <label className="block text-sm">Refund amount ($)<Input type="number" min="0.01" max={remainder / 100} step="0.01" value={amount} disabled={busy || canceled} onChange={(e) => setAmount(e.target.value)} /></label>}
            <p className="rounded-sm border border-destructive p-3 text-sm text-foreground">Refunding ends access immediately.</p>
          </>}
        </div>
      ) : info && <p className="mt-4 text-sm text-muted-foreground">{payment ? "Last card payment has already been fully refunded." : "No card payment to refund — cash payments are refunded at the counter."}</p>}
      <label htmlFor="cancel-reason" className="mt-4 block text-sm">Reason (required)</label>
      <textarea id="cancel-reason" value={reason} maxLength={300} disabled={busy || canceled} onChange={(e) => setReason(e.target.value)} rows={3}
        className="mt-1 w-full rounded-sm border border-input bg-background p-2 text-sm text-foreground focus:border-ring focus:outline-none" />
      {err && <div role="alert" className="mt-3 rounded-sm border border-destructive p-3 text-sm text-foreground">{err}</div>}
      <div className="mt-4 flex flex-wrap gap-3">
        {!canceled && <Button variant="destructive" disabled={busy || loading || reason.trim().length < 5 || !validAmount} onClick={submit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : refund ? "Cancel membership & refund" : "Cancel membership"}
        </Button>}
        <Button variant="outline" disabled={busy} onClick={canceled ? onDone : onClose}>{canceled ? "Close & refresh" : "Keep membership"}</Button>
      </div>
    </Modal>
  );
}

/** Refund one card payment without canceling the membership or changing access dates. */
function RefundPayment({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => Promise<void> }) {
  const listFn = useServerFn(listMemberPayments);
  const refundFn = useServerFn(refundPayment);
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof listMemberPayments>>["payments"] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const payment = payments?.find((p) => p.payment_id === selected) ?? null;
  const remainder = payment ? payment.amount_cents - payment.refunded_cents : 0;
  const cents = mode === "full" ? remainder : Math.round(Number(amount) * 100);
  const valid = !!payment && remainder > 0 && Number.isFinite(cents) && cents > 0 && cents <= remainder && reason.trim().length >= 5;
  useEffect(() => {
    let active = true;
    listFn({ data: { membership_id: row.id } }).then((v) => {
      if (!active) return;
      setPayments(v.payments);
      const first = v.payments.find((p) => p.amount_cents - p.refunded_cents > 0);
      if (first) setSelected(first.payment_id);
    }).catch((e) => { if (active) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { active = false; };
  }, [listFn, row.id]);

  async function submit() {
    if (busy || !payment || !valid) return;
    setBusy(true); setErr(null);
    try {
      const result = await refundFn({ data: { membership_id: row.id, payment_id: payment.payment_id, amount_cents: cents, reason: reason.trim() } });
      if (!result.ok) setErr(result.error ?? "The refund failed.");
      else await onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  return (
    <Modal onClose={busy ? () => {} : onClose} title="Refund a payment">
      <p className="text-sm text-muted-foreground">Refund without canceling — membership and billing stay as they are.</p>
      {payments === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading card payments…</p>
      ) : payments.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No card payments found — cash refunds are handled at the counter.</p>
      ) : (
        <>
          <div className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto">
            {payments.map((p) => {
              const rem = p.amount_cents - p.refunded_cents;
              return (
                <label
                  key={p.payment_id}
                  className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 text-sm ${selected === p.payment_id ? "border-gold/60 bg-gold/5" : "border-border"} ${rem <= 0 ? "opacity-50" : ""}`}
                >
                  <input
                    type="radio" name="refund-payment" className="mt-1"
                    checked={selected === p.payment_id} disabled={busy || rem <= 0}
                    onChange={() => { setSelected(p.payment_id); setMode("full"); setAmount(""); }}
                  />
                  <span>
                    <span className="font-semibold text-foreground">${(p.amount_cents / 100).toFixed(2)}</span>
                    <span className="text-muted-foreground"> — {new Date(p.date).toLocaleString()} · {p.brand.replaceAll("_", " ")} •••• {p.last4} · {p.source}</span>
                    {p.refunded_cents > 0 && <span className="block text-xs text-muted-foreground">Already refunded ${(p.refunded_cents / 100).toFixed(2)} · Remaining ${(rem / 100).toFixed(2)}</span>}
                    {p.possible_duplicate && (
                      <span className="mt-1 inline-block rounded-sm border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">Possible duplicate</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {payment && remainder > 0 && (
            <>
              <div role="group" aria-label="Refund amount" className="mt-4 flex gap-2">
                <Button size="sm" variant={mode === "full" ? "default" : "outline"} aria-pressed={mode === "full"} disabled={busy} onClick={() => setMode("full")}>Full</Button>
                <Button size="sm" variant={mode === "partial" ? "default" : "outline"} aria-pressed={mode === "partial"} disabled={busy} onClick={() => setMode("partial")}>Partial</Button>
              </div>
              {mode === "partial" && <label className="mt-2 block text-sm">Refund amount ($)<Input type="number" min="0.01" max={remainder / 100} step="0.01" value={amount} disabled={busy} onChange={(e) => setAmount(e.target.value)} /></label>}
              <p className="mt-3 rounded-sm border border-border p-3 text-sm text-muted-foreground">This does not cancel the membership or change access dates.</p>
            </>
          )}
        </>
      )}
      <label htmlFor="refund-reason" className="mt-4 block text-sm">Reason (required)</label>
      <textarea id="refund-reason" value={reason} maxLength={300} disabled={busy} onChange={(e) => setReason(e.target.value)} rows={3}
        className="mt-1 w-full rounded-sm border border-input bg-background p-2 text-sm text-foreground focus:border-ring focus:outline-none" />
      {err && <div role="alert" className="mt-3 rounded-sm border border-destructive p-3 text-sm text-foreground">{err}</div>}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button disabled={busy || !valid} onClick={submit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Refund $${cents > 0 ? (cents / 100).toFixed(2) : "0.00"}`}
        </Button>
        <Button variant="outline" disabled={busy} onClick={onClose}>Keep membership</Button>
      </div>
    </Modal>
  );
}

/** Confirm + permanently delete all selected members. */
function BulkDelete({ rows, onClose, onDone }: {
  rows: Row[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const bulkFn = useServerFn(bulkDeleteMembers);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      await bulkFn({ data: { customer_ids: rows.map((r) => r.customer_id), reason: reason.trim() } });
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`Permanently delete ${rows.length} member${rows.length === 1 ? "" : "s"}?`}>
      <p className="text-sm text-cream/70">
        This removes their memberships, appointments, and customer records. The deletion is logged and cannot be undone.
      </p>
      <div className="mt-4 max-h-40 space-y-1 overflow-y-auto rounded-sm border border-white/10 p-3 text-sm">
        {rows.map((r) => {
          const c = r.customers as { first_name: string; last_name: string } | null;
          return <div key={r.id} className="text-cream/80">{c ? `${c.first_name} ${c.last_name}` : r.customer_id}</div>;
        })}
      </div>
      <label className="mt-4 block text-[10px] uppercase tracking-[0.16em] text-cream/50">Reason (required)</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-sm border border-white/10 bg-black/40 p-2 text-sm text-cream focus:border-red-400/60 focus:outline-none"
      />
      {err && <div className="mt-3 rounded-sm border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{err}</div>}
      <div className="mt-4 flex gap-3">
        <button type="button" disabled={busy || reason.trim().length < 5} onClick={submit}
          className="rounded-sm border border-red-500/60 bg-red-600/80 px-4 py-2 text-xs uppercase tracking-[0.16em] text-white transition hover:bg-red-600 disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete permanently"}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
      </div>
    </Modal>
  );
}

/** Remove ONE duplicate membership row; the customer and their other membership stay. */
function RemoveDuplicate({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => Promise<void> }) {
  const removeFn = useServerFn(removeDuplicateMembership);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const c = row.customers as { first_name: string; last_name: string } | null;

  async function submit() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      await removeFn({ data: { membership_id: row.id, reason: reason.trim() } });
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Remove duplicate membership?">
      <p className="text-sm text-cream/70">
        This removes only this one membership row for {c ? `${c.first_name} ${c.last_name}` : "this member"} ({row.tier}, {row.status}).
        The customer and their other membership are kept.
        {row.square_subscription_id ? ` Its Square subscription (${row.square_subscription_id}) will be cancelled first.` : ""}
      </p>
      <p className="mt-3 rounded-sm border border-gold/40 bg-gold/10 p-2 text-xs text-cream/90">
        This does NOT issue a refund. Refund any extra charge from the payment in the Square Dashboard.
      </p>
      <label className="mt-4 block text-[10px] uppercase tracking-[0.16em] text-cream/50">Reason (required)</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-sm border border-white/10 bg-black/40 p-2 text-sm text-cream focus:border-red-400/60 focus:outline-none"
      />
      {err && <div className="mt-3 rounded-sm border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{err}</div>}
      <div className="mt-4 flex gap-3">
        <button type="button" disabled={busy || reason.trim().length < 5} onClick={submit}
          className="rounded-sm border border-red-500/60 bg-red-600/80 px-4 py-2 text-xs uppercase tracking-[0.16em] text-white transition hover:bg-red-600 disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove duplicate"}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
      </div>
    </Modal>
  );
}

type EditTarget = {
  customer_id: string;
  membership_id: string;
  status: (typeof STATUSES)[number];
  current_period_end: string;
  needs_review: boolean;
  created_at: string | null;
  expiration_edit_count: number;
  first_expiration_edit_at: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  plan_id: string;
  on_card: boolean;
};

function toEditTarget(r: Row): EditTarget {
  const c = r.customers as { first_name: string; last_name: string; email: string; phone: string } | null;
  return {
    customer_id: r.customer_id,
    membership_id: r.id,
    status: r.status as (typeof STATUSES)[number],
    current_period_end: r.current_period_end ? r.current_period_end.slice(0, 10) : "",
    needs_review: r.needs_review,
    created_at: r.created_at ?? null,
    expiration_edit_count: r.expiration_edit_count ?? 0,
    first_expiration_edit_at: r.first_expiration_edit_at ?? null,
    first_name: c?.first_name ?? "",
    last_name: c?.last_name ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    plan_id: r.plan_id ?? "",
    on_card: !!r.square_subscription_id,
  };
}

/**
 * Member detail popup — a second entry point to the kiosk result screen.
 * Renders the exact same panel components the kiosk uses, plus Renew / Edit shortcuts.
 */
function MemberDetail({ row, isAdmin, onClose, onEdit, onChanged, onCancelMembership, onRefundPayment }: {
  row: Row;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => Promise<void> | void;
  onCancelMembership: () => void;
  onRefundPayment: () => void;
}) {
  const panelFn = useServerFn(getMemberPanel);
  const refundInfoFn = useServerFn(getMembershipRefundInfo);
  const [refunds, setRefunds] = useState<Awaited<ReturnType<typeof getMembershipRefundInfo>>["refunds"]>([]);
  useEffect(() => {
    if (isAdmin) refundInfoFn({ data: { membership_id: row.id, history_only: true } }).then((v) => setRefunds(v.refunds)).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [isAdmin, row.id, refundInfoFn]);
  const configFn = useServerFn(getSquareConfig);
  const [panel, setPanel] = useState<PanelResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [renew, setRenew] = useState(false);
  const [resub, setResub] = useState(false);
  const deleteFn = useServerFn(deleteMember);
  const [deleting, setDeleting] = useState(false);
  const [delName, setDelName] = useState("");
  const [delReason, setDelReason] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const paidFn = useServerFn(markCashPaid);
  const [payBusy, setPayBusy] = useState(false);
  const [cashReceiptPath, setCashReceiptPath] = useState("");

  async function markPaid() {
    setErr(null); setPayBusy(true);
    try {
      await paidFn({ data: { customer_id: row.customer_id, receipt_photo_path: cashReceiptPath } });
      setCashReceiptPath("");
      await loadPanel();
      await onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setPayBusy(false);
  }

  const c = row.customers as { first_name: string; last_name: string } | null;
  const fullName = c ? `${c.first_name} ${c.last_name}` : "Member";

  async function loadPanel() {
    try {
      setPanel(await panelFn({ data: { customer_id: row.customer_id } }) as PanelResult);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  useEffect(() => { loadPanel(); /* eslint-disable-next-line */ }, [row]);
  useEffect(() => { configFn().then((c) => setCardReady(!!c.application_id && !!c.location_id)).catch(() => setCardReady(false)); }, [configFn]);

  async function afterRenewed() {
    setRenew(false); setResub(false);
    await loadPanel();
    await onChanged();
  }

  async function confirmDelete() {
    setErr(null); setDelBusy(true);
    try {
      await deleteFn({ data: { customer_id: row.customer_id, confirm_name: delName.trim(), reason: delReason.trim() } });
      await onChanged();
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setDelBusy(false);
  }

  const expired = !!panel && !panel.approved && panel.reason_code === "expired";
  const noMembership = !!panel && !panel.approved && panel.reason_code === "no_membership";
  const overlay = renew || resub;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl rounded-sm border border-white/10 bg-ink p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Member detail</div>
            <div className="mt-2 mb-3">
              <MemberPhoto customerId={panel?.customer_id ?? null} url={panel?.photo_url ?? null} name={fullName} size={72} />
            </div>
            <h3 className="mt-1 font-display text-xl text-cream">{fullName}</h3>
            {panel?.auto_billing && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                <Repeat className="h-3 w-3" /> Auto-billing
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-cream/50 hover:text-gold"><X className="h-4 w-4" /></button>
        </div>

        {err && <div className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}

        {panel?.payment_due && !overlay && (
          <div className="mt-4 rounded-sm border border-amber-400/50 bg-amber-500/10 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Payment pending</div>
            <p className="mt-1 text-sm text-cream/80">
              Please settle your payment. This membership was due on{" "}
              {panel.current_period_end ? fmt(panel.current_period_end) : `the ${billingDayLabel(panel.billing_day ?? 10)}`} and stays pending until the cash is
              taken at the desk.
            </p>
            <ReceiptCapture
              customerId={row.customer_id}
              path={cashReceiptPath}
              onChange={(path) => setCashReceiptPath(path ?? "")}
              onError={setErr}
            />
          </div>
        )}

        {!panel ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-cream/60"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : overlay ? (
          renew && panel.customer_id ? (
            <RenewFlow
              customerId={panel.customer_id}
              firstName={panel.first_name}
              currentTier={panel.tier}
              currentPlanId={panel.plan_id}
              currentPeriodEnd={panel.current_period_end ?? null}
              needsReview={panel.needs_review === true}
              billingDay={panel.billing_day ?? null}
              onCancel={() => setRenew(false)}
              onDone={afterRenewed}
            />
          ) : resub && panel.customer_id && cardReady ? (
            <ResubscribeFlow
              customerId={panel.customer_id}
              firstName={panel.first_name}
              currentTier={panel.tier}
              billingDay={panel.billing_day ?? null}
              onCancel={() => setResub(false)}
              onReactivated={afterRenewed}
            />
          ) : null
        ) : panel.approved ? (
          <ApprovedPanel result={panel} eyebrow="Active membership" />
        ) : expired || noMembership ? (
          <ExpiredPanel
            result={panel}
            variant={noMembership ? "no_membership" : "expired"}
            cardReady={cardReady}
            onResubscribe={() => setResub(true)}
            onRenew={() => setRenew(true)}
          />
        ) : (
          <DeniedPanel result={panel} eyebrow="No membership record" />
        )}

        {isAdmin && !overlay && refunds.length > 0 && <div className="mt-4 border-t border-border pt-4">
          <h4 className="text-sm font-semibold">Refunds</h4>
          {refunds.map((r, i) => <p key={r.square_refund_id ?? i} className="mt-2 text-sm text-muted-foreground">
            {r.status === "FAILED" || r.status === "REJECTED" || r.status === "REQUESTED" ? "Refund" : "Refunded"} ${(r.amount_cents / 100).toFixed(2)} on {fmt(r.created_at)} — {r.status === "REQUESTED" ? "Pending request" : r.status.charAt(0) + r.status.slice(1).toLowerCase()} · {r.kind === "standalone" ? "Refund (membership kept)" : "Refund + cancel"}
          </p>)}
        </div>}
        {!overlay && !deleting && (
          <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
            {(panel?.payment_due || panel?.approved || (panel && !panel.auto_billing && cardReady)) && (
              <div className="flex flex-wrap gap-3">
                {panel?.payment_due && (
                  <button
                    onClick={markPaid}
                    disabled={payBusy || !cashReceiptPath}
                    className="rounded-sm border border-amber-400/60 bg-amber-400/15 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100 transition hover:bg-amber-400/25 disabled:opacity-50"
                  >
                    {payBusy ? <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> : <Banknote className="mr-2 inline h-3.5 w-3.5" />}
                    Mark as paid
                  </button>
                )}
                {panel?.approved && (
                  <button onClick={() => setRenew(true)} className="btn-gold px-5 py-2.5">Renew</button>
                )}
                {panel && !panel.auto_billing && cardReady && (
                  <button
                    onClick={() => setResub(true)}
                    className="rounded-sm border border-emerald-400/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300 transition hover:bg-emerald-500/10"
                  >
                    <Repeat className="mr-2 inline h-3.5 w-3.5" />Set up auto-billing
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 max-[419px]:grid-cols-1">
              <button onClick={onEdit} className={`w-full rounded-sm border border-gold/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold transition hover:bg-gold/10 ${isAdmin ? "" : "col-span-2"}`}>
                <Pencil className="mr-2 inline h-3.5 w-3.5" />Edit / override
              </button>
              {isAdmin && (
                <button
                  onClick={onRefundPayment}
                  title="Refund without canceling — membership and billing stay as they are."
                  className="w-full rounded-sm border border-gold/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold transition hover:bg-gold/10"
                >
                  <Undo2 className="mr-2 inline h-3.5 w-3.5" />Refund payment
                </button>
              )}
            </div>
            <div>
              <div className="mt-2 h-px w-full bg-white/10" />
              <div className="mt-3 grid grid-cols-2 gap-3 max-[419px]:grid-cols-1">
                {isAdmin && row.status !== "canceled" && (
                  <button
                    onClick={onCancelMembership}
                    title="Stops billing. Member keeps their record and history, and keeps access until their paid period ends."
                    className="w-full rounded-sm border border-red-500/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300 transition hover:bg-red-500/10"
                  >
                    <Ban className="mr-2 inline h-3.5 w-3.5" />Cancel membership
                  </button>
                )}
                <button
                  onClick={() => setDeleting(true)}
                  title="Permanently erases this member, their membership and appointments. Can't be undone."
                  className={`w-full rounded-sm border border-red-500/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300 transition hover:bg-red-500/10 ${isAdmin && row.status !== "canceled" ? "" : "col-span-2"}`}
                >
                  <Trash2 className="mr-2 inline h-3.5 w-3.5" />Delete member
                </button>
              </div>
            </div>
          </div>
        )}

        {deleting && (
          <div className="mt-6 space-y-4 rounded-sm border border-red-500/40 bg-red-500/5 p-4">
            <div>
              <div className="font-display text-base text-red-200">Permanently delete {fullName}?</div>
              <p className="mt-1 text-xs text-cream/60">
                This removes their memberships, appointments, and customer record. The deletion is logged and cannot be undone.
              </p>
            </div>
            <label className="block text-xs uppercase tracking-widest text-cream/50">
              Type the member's full name to confirm
              <input
                value={delName}
                onChange={(e) => setDelName(e.target.value)}
                placeholder={fullName}
                className="mt-1 w-full rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-sm text-cream outline-none focus:border-red-400/60"
              />
            </label>
            <label className="block text-xs uppercase tracking-widest text-cream/50">
              Reason (required)
              <textarea
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
                rows={2}
                placeholder="e.g. duplicate record, requested by customer…"
                className="mt-1 w-full rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-sm text-cream outline-none focus:border-red-400/60"
              />
            </label>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={delBusy || delName.trim().toLowerCase() !== fullName.toLowerCase() || delReason.trim().length < 5}
                className="rounded-sm bg-red-600 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-red-500 disabled:opacity-40"
              >
                {delBusy ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                onClick={() => { setDeleting(false); setDelName(""); setDelReason(""); }}
                className="rounded-sm border border-white/15 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/70 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-cream/45">
          Same screen the kiosk shows. Renewals here use the identical one-time charge — no subscription is created.
        </p>
      </div>
    </div>
  );
}



function EditCustomer({
  target, onClose, onDone, saveFn, saveMembershipFn, overrideFn,
}: {
  target: EditTarget;
  onClose: () => void;
  onDone: () => void;
  saveFn: ReturnType<typeof useServerFn<typeof updateCustomerDetails>>;
  saveMembershipFn: ReturnType<typeof useServerFn<typeof updateMembership>>;
  overrideFn: ReturnType<typeof useServerFn<typeof overrideMembershipExpiration>>;
}) {
  const [form, setForm] = useState(target);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideDate, setOverrideDate] = useState(target.current_period_end);
  const [overrideReason, setOverrideReason] = useState("");
  const planFn = useServerFn(changeMembershipPlan);
  const [planId, setPlanId] = useState(target.plan_id);
  const [planBusy, setPlanBusy] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);

  async function savePlan() {
    setErr(null); setPlanMsg(null); setPlanBusy(true);
    try {
      const res = await planFn({ data: { id: target.membership_id, plan_id: planId } });
      setPlanMsg(
        res.changed
          ? `Moved to ${res.plan_name}.${res.next_billing_at ? ` Next charge ${new Date(res.next_billing_at).toLocaleDateString()}.` : ""}`
          : "That is already their plan.",
      );
      if (res.changed && res.warning) setErr(res.warning);
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setPlanBusy(false);
  }

  const editsOpen = expirationEditsOpen(target);
  const daysLeft = target.first_expiration_edit_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(target.first_expiration_edit_at).getTime() + EXPIRATION_EDIT_WINDOW_DAYS * 864e5 - Date.now()) / 864e5,
        ),
      )
    : EXPIRATION_EDIT_WINDOW_DAYS;

  async function save() {
    setErr(null); setBusy(true);
    try {
      await saveFn({ data: {
        customer_id: target.customer_id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      } });
      await saveMembershipFn({ data: {
        id: target.membership_id,
        status: target.status,
        ...(editsOpen && form.current_period_end ? { current_period_end: form.current_period_end } : {}),
      } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  async function saveOverride() {
    setErr(null); setBusy(true);
    try {
      await overrideFn({ data: {
        id: target.membership_id,
        current_period_end: overrideDate,
        reason: overrideReason.trim(),
      } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }


  const fields = [
    { key: "first_name", label: "First name", type: "text" },
    { key: "last_name", label: "Last name", type: "text" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone", type: "tel" },
  ] as const;

  return (
    <Modal title="Edit customer" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <label key={f.key} className={f.key === "email" || f.key === "phone" ? "col-span-2 block" : "block"}>
              <span className="text-[10px] uppercase tracking-[0.2em] text-cream/45">{f.label}</span>
              <input
                type={f.type}
                value={form[f.key]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [f.key]:
                      f.key === "phone"
                        ? e.target.value.replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "")
                        : e.target.value,
                  })
                }
                placeholder={f.key === "phone" ? "(212) 555-0134" : undefined}
                className="mt-1 w-full rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-cream outline-none focus:border-gold/60"
              />
            </label>
          ))}
        </div>
        <div className="space-y-2 rounded-sm border border-white/10 bg-white/[0.02] p-3">
          <span className="text-[10px] uppercase tracking-[0.2em] text-cream/45">Membership plan</span>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-cream outline-none focus:border-gold/60"
          >
            {!target.plan_id && <option value="">Select a plan…</option>}
            {getMemberships().map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — ${(m.amountCents / 100).toFixed(2)}/{m.billingInterval === "year" ? "yr" : "mo"}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-cream/50">
            {target.on_card
              ? "Card members are not charged today — their card subscription restarts on the new price from their next billing day."
              : "Cash / imported members: the plan on file changes now, and the new price applies at their next renewal."}
          </p>
          {planMsg && <div className="rounded-sm border border-gold/30 bg-gold/5 p-2 text-[11px] text-gold">{planMsg}</div>}
          <button
            onClick={savePlan}
            disabled={planBusy || !planId || planId === target.plan_id}
            className="w-full rounded-sm border border-gold/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold transition hover:bg-gold/10 disabled:opacity-40"
          >
            {planBusy ? "Updating…" : "Change plan"}
          </button>
        </div>

        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-cream/45">Expiration date</span>
          <input
            type="date"
            value={form.current_period_end}
            disabled={!editsOpen}
            onChange={(e) => setForm({ ...form, current_period_end: e.target.value })}
            className={`mt-1 w-full rounded-sm border px-3 py-2 outline-none ${
              editsOpen
                ? "border-white/15 bg-black/40 text-cream focus:border-gold/60"
                : "cursor-not-allowed border-white/10 bg-white/[0.03] text-cream/50"
            }`}
          />
          {target.needs_review && target.created_at && (
            <span className="mt-1 block text-[11px] text-cream/60">
              Member since {new Date(target.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              {" "}— for a monthly plan their real cycle likely lands around the
              {" "}{new Date(target.created_at).getDate()}
              {(() => { const n = new Date(target.created_at!).getDate(); return n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"; })()}
              {" "}of each month. Confirm the real date with the customer — this is a hint only.
            </span>
          )}
          {editsOpen ? (
            <span className="mt-1 block text-[11px] text-amber-200/80">
              Edit {Math.min(target.expiration_edit_count + 1, EXPIRATION_EDIT_LIMIT)} of {EXPIRATION_EDIT_LIMIT} —
              {target.first_expiration_edit_at
                ? ` locks in ${daysLeft} day${daysLeft === 1 ? "" : "s"} or after ${EXPIRATION_EDIT_LIMIT} edits.`
                : ` locks ${EXPIRATION_EDIT_WINDOW_DAYS} days after your first correction, or after ${EXPIRATION_EDIT_LIMIT} edits.`}
            </span>
          ) : (
            <span className="mt-1 block text-[11px] text-cream/50">
              Locked — this date now changes only through a renewal, a card subscription sync, or an admin override.
            </span>
          )}
        </label>

        {!editsOpen && (
          overrideOpen ? (
            <div className="space-y-3 rounded-sm border border-gold/30 bg-gold/5 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gold">Override expiration date</div>
              <input
                type="date"
                value={overrideDate}
                onChange={(e) => setOverrideDate(e.target.value)}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-cream outline-none focus:border-gold/60"
              />
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={2}
                placeholder="Reason (required, logged)"
                className="w-full rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-cream outline-none focus:border-gold/60"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveOverride}
                  disabled={busy || overrideReason.trim().length < 5 || !overrideDate}
                  className="btn-gold flex-1 disabled:opacity-50"
                >Save override</button>
                <button onClick={() => setOverrideOpen(false)} className="rounded-sm border border-white/20 px-3 text-xs text-cream/70 hover:text-gold">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setOverrideOpen(true)} className="text-xs text-gold/80 underline hover:text-gold">
              Override expiration date (reason required)
            </button>
          )
        )}
        <p className="text-xs text-cream/45">
          Phone is used for kiosk check-in. Leave blank if unknown. Members imported from the old platform show
          “Needs review” until a real expiration date is saved here.
        </p>

        {err && <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}
        <button onClick={save} disabled={busy} className="btn-gold w-full">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
      <div className="text-[10px] uppercase tracking-[0.24em] text-cream/45">{label}</div>
      <div className="mt-2 font-numeric text-3xl text-gold">{value}</div>
    </div>
  );
}

function ExpiringCard({ title, rows }: { title: string; rows: Array<{ id: string; tier: string; current_period_end: string | null; customers: unknown }> }) {
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
      <div className="text-[10px] uppercase tracking-[0.24em] text-cream/45">{title}</div>
      <div className="mt-4 space-y-2 text-sm">
        {rows.length === 0 && <div className="text-cream/50">Nothing expiring.</div>}
        {rows.map((r) => {
          const c = r.customers as { first_name: string; last_name: string; phone: string } | null;
          return (
            <div key={r.id} className="flex items-center justify-between border-b border-white/5 pb-2">
              <div>
                <div>{c ? `${c.first_name} ${c.last_name}` : "—"}</div>
                <div className="text-xs text-cream/40">{r.tier} · {c?.phone}</div>
              </div>
              <div className="text-xs text-cream/60">{fmt(r.current_period_end)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-sm border border-white/10 bg-ink p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl text-cream">{title}</h3>
          <button onClick={onClose} className="text-cream/50 hover:text-gold"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

/** New-customer signup with a payment step: enter details and plan, then take
 *  cash at the desk or put them on automatic card billing.
 *  Existing members renew from their detail card. */
function AddMembership({
  onClose, onDone, addFn,
}: {
  onClose: () => void;
  onDone: (name: string) => Promise<void>;
  addFn: ReturnType<typeof useServerFn<typeof addManualMembership>>;
}) {
  
  const startAutoFn = useServerFn(startNewMemberAutoBilling);
  const [nc, setNc] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [planId, setPlanId] = useState(getMemberships()[0]?.id ?? "");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("active");
  const [end, setEnd] = useState(() => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));
  const [step, setStep] = useState<"details" | "method" | "cash" | "auto">("details");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previewFn = useServerFn(previewPlanBilling);
  const [preview, setPreview] = useState<{ first_charge_cents: number; first_charge_total_cents?: number; next_billing_at: string; billing_day?: number } | null>(null);

  useEffect(() => {
    if (step !== "method" || !planId) return;
    setPreview(null);
    previewFn({ data: { plan_id: planId } }).then(setPreview).catch(() => setPreview(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, planId]);


  const plan = getMemberships().find((m) => m.id === planId);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nc.email.trim());
  const detailsReady =
    nc.first_name.trim() !== "" && nc.last_name.trim() !== "" &&
    emailOk && nc.phone.trim().length >= 7;
  const cleanCustomer = {
    first_name: nc.first_name.trim(),
    last_name: nc.last_name.trim(),
    email: nc.email.trim().toLowerCase(),
    phone: nc.phone.trim(),
  };


  const inputCls = "rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-cream outline-none focus:border-gold/60";
  const labelCls = "text-[10px] uppercase tracking-[0.2em] text-cream/45";

  /** Turn raw validation output into something staff can act on. */
  function friendly(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (/invalid[_ ]?(string|email)/i.test(msg) || /"email"/.test(msg)) {
      return "Please enter a valid email address for this customer (for example name@example.com).";
    }
    return msg;
  }

  async function saveMembership(payment: { payment_method: "cash" }) {
    if (!receiptPath) { setErr("Attach a photo of the receipt first."); return; }
    setErr(null); setBusy(true);
    try {
      await addFn({ data: {
        new_customer: cleanCustomer,
        plan_id: planId,
        tier: plan?.tier ?? "Member",
        status,
        current_period_end: end,
        ...payment,
        receipt_photo_path: receiptPath,
      } });
      await onDone(`${cleanCustomer.first_name} ${cleanCustomer.last_name}`);
    } catch (e) { setErr(friendly(e)); }
    setBusy(false);
  }

  /** Auto-billing: nothing today, then automatic renewals on the billing day. */
  function startAuto() {
    setErr(null);
    setStep("auto");
  }


  return (
    <Modal title="Add membership" onClose={onClose}>
      <div className="space-y-4 text-sm">
        {step === "details" && (
          <>
            <p className="text-xs text-cream/50">
              New customers only — to renew or change an existing member, open their name in the list and use the detail card.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(["first_name", "last_name", "email", "phone"] as const).map((f) => (
                <input key={f} value={nc[f]} onChange={(e) => setNc({ ...nc, [f]: e.target.value })}
                  placeholder={f.replace("_", " ")}
                  type={f === "email" ? "email" : "text"}
                  className={inputCls + (f === "email" && nc.email.trim() !== "" && !emailOk ? " border-red-500/60" : "")} />
              ))}
            </div>
            {nc.email.trim() !== "" && !emailOk && (
              <p className="text-xs text-red-400">Enter a valid email address, e.g. name@example.com.</p>
            )}


            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Plan</span>
                <select value={planId} onChange={(e) => setPlanId(e.target.value)}
                  className={`mt-1 w-full ${inputCls}`}>
                  {getMemberships().map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
                  className={`mt-1 w-full ${inputCls}`}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className={labelCls}>Current period end</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className={`mt-1 w-full ${inputCls}`} />
            </label>

            {err && <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}
            <button onClick={() => setStep("method")} disabled={!detailsReady} className="btn-gold w-full disabled:opacity-40">
              Continue to payment{plan ? ` — ${plan.price}` : ""}
            </button>
            <p className="text-center text-xs text-cream/40">A member code is generated automatically.</p>
          </>
        )}

        {step === "method" && (
          <>
            <button type="button" onClick={() => { setStep("details"); setErr(null); }}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-cream/50 hover:text-gold">
              <ChevronLeft className="h-3.5 w-3.5" /> Back to details
            </button>
            <p className="text-sm text-cream/75">
              New <span className="text-gold">{plan?.name}</span> membership for {nc.first_name} {nc.last_name}
              {plan ? ` · ${plan.price} ${plan.cadence}` : ""}.
            </p>
            <button type="button" onClick={() => { setStep("cash"); setReceiptPath(null); setErr(null); }} disabled={busy}
              className="flex w-full items-center gap-3 rounded-sm border border-white/10 bg-white/[0.02] p-5 text-left transition hover:border-gold/50 disabled:opacity-50">
              <Banknote className="h-5 w-5 text-gold" />
              <span>
                <span className="block text-sm text-cream">Cash</span>
                <span className="block text-[10px] uppercase tracking-[0.2em] text-cream/50">
                  Taken at the desk · next payment {plan?.price} due{" "}
                  {preview ? new Date(preview.next_billing_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "on the next billing day"}
                </span>
              </span>
            </button>
            <button type="button" onClick={startAuto} disabled={busy}
              className="flex w-full items-center gap-3 rounded-sm border border-emerald-400/40 bg-emerald-400/[0.06] p-5 text-left transition hover:border-emerald-300 disabled:opacity-50">
              <CreditCard className="h-5 w-5 text-emerald-300" />
              <span>
                <span className="block text-sm text-cream">Card on auto-billing</span>
                <span className="block text-[10px] uppercase tracking-[0.2em] text-cream/50">
                  {plan
                    ? (plan.billingInterval === "year"
                      ? `Full year today · renews ${preview ? new Date(preview.next_billing_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "in a year"}`
                      : `${plan.price} + tax today · renews on the ${billingDayLabel(preview?.billing_day ?? billingDayForNewMembership())}`)
                    : "Full price + tax today, then renews on the signup day"}
                </span>
              </span>
            </button>
            {busy && (
              <div className="flex items-center gap-2 text-sm text-cream/60">
                <Loader2 className="h-4 w-4 animate-spin" /> Working…
              </div>
            )}
            {err && <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}
          </>
        )}

        {step === "cash" && (
          <>
            <button type="button" onClick={() => { setStep("method"); setReceiptPath(null); setErr(null); }}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-cream/50 hover:text-gold">
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
            <p className="text-sm text-cream/75">
              Cash taken at the desk for the new <span className="text-gold">{plan?.name}</span> membership.
            </p>
            <ReceiptCapture
              customerId={`new-${nc.email.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "customer"}`}
              path={receiptPath} onChange={setReceiptPath} onError={setErr} />
            {err && <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}
            <button type="button" onClick={() => saveMembership({ payment_method: "cash" })}
              disabled={busy || !receiptPath} className="btn-gold w-full disabled:opacity-40">
              {busy ? "Saving…" : "Confirm membership"}
            </button>
          </>
        )}

        {step === "auto" && plan && (
          <>
            <button type="button" onClick={() => { setStep("method"); setErr(null); }}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-cream/50 hover:text-gold">
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
            <div className="rounded-sm border border-emerald-400/25 bg-emerald-400/[0.06] p-4 text-sm leading-7 text-cream/80">
              <span className="text-emerald-300">Auto-billing:</span>{" "}
              {preview
                ? (plan.billingInterval === "year"
                  ? `$${(preview.first_charge_cents / 100).toFixed(2)} + tax today for the full year, then ${plan.price} + tax on ${new Date(preview.next_billing_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}.`
                  : `$${(preview.first_charge_cents / 100).toFixed(2)} + tax today, then ${plan.price} + tax on the ${billingDayLabel(preview.billing_day ?? billingDayForNewMembership())} of each month${(preview.billing_day ?? billingDayForNewMembership()) > 28 ? " (last day in shorter months)" : ""}. Next billing: ${new Date(preview.next_billing_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}.`)
                : "Calculating today's charge…"}
            </div>
            <SquareCardForm
              buttonLabel={preview ? `Pay $${((preview.first_charge_total_cents ?? 0) / 100).toFixed(2)}` : `Pay`}
              amountCents={preview?.first_charge_total_cents ?? Math.round(plan.amountCents * 1.08875)}
              cardholder={`${nc.first_name} ${nc.last_name}`.trim()}
              email={cleanCustomer.email}
              onError={setErr}
              onToken={async ({ source_id, verification_token }) => {
                setErr(null);
                await startAutoFn({
                  data: { new_customer: cleanCustomer, plan_id: planId, source_id, verification_token },
                });
                await onDone(`${cleanCustomer.first_name} ${cleanCustomer.last_name}`);
              }}
            />
            {err && <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}
            <div className="text-right text-[10px] uppercase tracking-[0.24em] text-cream/40">Secured by Square</div>
          </>
        )}

      </div>
    </Modal>
  );
}
