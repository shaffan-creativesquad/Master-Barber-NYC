import { billingDayForNewMembership, billingDayLabel, joinChargeQuote, nextBillingDate, toBillingDay, type BillingDay } from "@/lib/billing-proration";
/**
 * Shared kiosk result panel.
 *
 * Used by the check-in kiosk (`/validator`) and by the member detail popup on the
 * admin Members page. Keep all result-screen presentation here so both surfaces
 * stay in sync automatically.
 */
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { renewMembership, resubscribeMember, setMemberPhoto } from "@/lib/members.functions";
import { SquareCardForm } from "@/components/square-card";
import { getMemberships, type Membership } from "@/lib/site-data";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, Camera, CalendarClock, Check, ChevronLeft, CreditCard, Loader2, Scissors, ShieldAlert, X } from "lucide-react";

/**
 * Required receipt photo for cash renewals. Opens the camera directly on a
 * touch device (capture="environment") and falls back to the photo library.
 * Uploads straight to the private `cash-receipts` bucket and hands back the
 * storage path so it can be stored on the renewal log row.
 */
export function ReceiptCapture({ customerId, path, onChange, onError }: {
  customerId: string;
  path: string | null;
  onChange: (path: string | null) => void;
  onError: (msg: string | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setBusy(true); onError(null);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const key = `${customerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("cash-receipts").upload(key, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (error) throw new Error(error.message);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      onChange(key);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not upload the receipt photo.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-5 rounded-sm border border-white/10 bg-white/[0.02] p-5">
      <div className="text-sm text-cream">Attach a photo of the receipt.</div>
      <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-cream/45">Required for cash renewals</p>

      {path && preview ? (
        <div className="mt-4 flex items-center gap-4">
          <img src={preview} alt="Receipt preview" className="h-28 w-28 rounded-sm border border-white/10 object-cover" />
          <div>
            <div className="flex items-center gap-2 text-sm text-emerald-300"><Check className="h-4 w-4" /> Photo attached</div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-sm border border-white/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-cream/70 hover:border-gold/50 hover:text-gold">
              <Camera className="h-3.5 w-3.5" /> Retake
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm text-gold hover:border-gold">
            <Camera className="h-4 w-4" /> {busy ? "Uploading…" : "Take photo"}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy}
              onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-white/15 px-4 py-2.5 text-sm text-cream/70 hover:border-gold/50 hover:text-gold">
            Choose from device
            <input type="file" accept="image/*" className="hidden" disabled={busy}
              onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
        </div>
      )}
      {busy && <div className="mt-3 flex items-center gap-2 text-xs text-cream/60"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading photo…</div>}
    </div>
  );
}

/** Member profile photo: shows the current photo and lets staff replace it. */
export function MemberPhoto({ customerId, url, name, onChanged, editable = true, size = 64 }: {
  customerId?: string | null;
  url: string | null;
  name?: string | null;
  onChanged?: (url: string | null) => void;
  editable?: boolean;
  size?: number;
}) {
  const setPhotoFn = useServerFn(setMemberPhoto);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const shown = local ?? url;
  const initials = (name ?? "")
    .split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

  async function handleFile(file: File | null | undefined) {
    if (!file || !customerId) return;
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const key = `${customerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("member-photos").upload(key, file, {
        contentType: file.type || "image/jpeg", upsert: false,
      });
      if (error) throw new Error(error.message);
      const r = await setPhotoFn({ data: { customer_id: customerId, photo_path: key } });
      setLocal(r.url ?? URL.createObjectURL(file));
      onChanged?.(r.url ?? null);
    } catch { /* surfaced by the empty state staying put */ }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3">
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 text-sm text-cream/60"
      >
        {shown
          ? <img src={shown} alt={name ? `${name} profile photo` : "Member photo"} className="h-full w-full object-cover" />
          : <span className="font-numeric tracking-widest">{initials}</span>}
      </div>
      {editable && customerId && (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-white/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-cream/70 hover:border-gold/50 hover:text-gold">
          <Camera className="h-3.5 w-3.5" /> {busy ? "Uploading…" : shown ? "Change photo" : "Add photo"}
          <input type="file" accept="image/*" className="hidden" disabled={busy}
            onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}

export type PanelResult = {
  approved: boolean;
  reason_code: "approved" | "expired" | "not_found" | "no_membership";
  reason?: string | null;
  staff_reason?: string | null;
  customer_id: string | null;
  first_name: string | null;
  photo_url?: string | null;
  tier: string | null;
  plan_id: string | null;
  member_since: string | null;
  visits_this_month: number;
  current_period_end: string | null;
  status?: string | null;
  needs_review?: boolean;
  billing_day?: number | null;
  auto_billing?: boolean;
  payment_due?: boolean;

  appointment: { starts_at: string; barber_name: string | null } | null;
};

export function planFor(planId: string | null, tier: string | null) {
  return (
    getMemberships().find((m) => m.id === planId) ??
    getMemberships().find((m) => m.tier.toLowerCase() === (tier ?? "").toLowerCase()) ??
    null
  );
}

const TIER_PILL: Record<string, string> = {
  bronze: "border-[#b87a55]/50 bg-[#b87a55]/15 text-[#e0a883]",
  silver: "border-[#cfc9b4]/40 bg-[#cfc9b4]/10 text-[#ded9c8]",
  gold: "border-gold/50 bg-gold/15 text-gold",
};

export function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-left">
      <div className="text-[10px] uppercase tracking-[0.22em] text-cream/40">{label}</div>
      <div className="mt-1 text-sm text-cream/90">{value}</div>
    </div>
  );
}

function daysFrom(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

const DATE_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

/** Standard membership-date label: card subscriptions are "Next billing",
 *  cash/manual/imported records are "Renewal due". */
export function formatMembershipDate(result: {
  current_period_end: string | null;
  status?: string | null;
  needs_review?: boolean | null;
  auto_billing?: boolean;
  source?: string | null;
  stripe_subscription_id?: string | null;
  square_subscription_id?: string | null;
}) {
  // `needs_review` is the single source of truth: while it is true no stored
  // date is trustworthy, so nothing is displayed regardless of its value.
  const needsReview = result.needs_review === true;
  const date = !needsReview && result.current_period_end
    ? new Date(result.current_period_end).toLocaleDateString(undefined, DATE_FMT)
    : null;
  // A canceled membership keeps access until the period already paid for ends.
  if (result.status === "canceled") {
    const future = !!date && new Date(result.current_period_end!).getTime() > Date.now();
    if (future) {
      return { label: "Cancels on", date, needsReview, full: `Cancels on: ${date}` };
    }
    return { label: "Canceled", date: null, needsReview, full: "Canceled" };
  }
  const isAuto =
    !!result.stripe_subscription_id || !!result.square_subscription_id ||
    result.auto_billing === true || result.source === "stripe" || result.source === "square";
  const label = isAuto ? "Next billing" : "Renewal due";
  return {
    label,
    date,
    needsReview,
    full: date ? `${label}: ${date}` : `${label}: —`,
  };
}

export function ApprovedPanel({ result, eyebrow }: { result: PanelResult; eyebrow?: string }) {
  const plan = planFor(result.plan_id, result.tier);
  const tierKey = (result.tier ?? "").toLowerCase();
  const includes = plan?.perks?.slice(0, 2).join(" · ");
  const appt = result.appointment;

  return (
    <div className="card-lux mt-8 border-emerald-500/30 p-6 text-left md:p-8">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
          <Check className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-3xl md:text-4xl">{result.first_name}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-emerald-300/80">
            {eyebrow ?? `Approved · checked in ${fmtTime(new Date())}`}
          </div>
        </div>
        {result.tier && (
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${
              TIER_PILL[tierKey] ?? TIER_PILL.gold
            }`}
          >
            {result.tier}
          </span>
        )}
      </div>

      <div className="mt-6 h-px w-full bg-white/10" />

      {appt && (
        <div className="mt-5 flex items-center gap-2 text-sm text-cream/90">
          <CalendarClock className="h-4 w-4 text-gold" />
          Booked with {appt.barber_name ?? "our team"}, {fmtTime(new Date(appt.starts_at))}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label="Plan" value={plan?.name ?? (result.tier ? `${result.tier} Unlimited` : "—")} />
        {(() => {
          const dateInfo = formatMembershipDate(result);
          return dateInfo.date ? (
            <Stat label={dateInfo.label} value={dateInfo.date!} />
          ) : (
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-[0.22em] text-cream/40">{dateInfo.label}</div>
              <div className="mt-1 inline-block rounded-full border border-amber-400/50 bg-amber-500/15 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-amber-200">
                Needs review
              </div>
            </div>
          );
        })()}
        <Stat
          label="Member since"
          value={
            result.member_since
              ? new Date(result.member_since).toLocaleDateString(undefined, { month: "short", year: "numeric" })
              : "—"
          }
        />
        <Stat label="Visits this month" value={String(result.visits_this_month ?? 0)} />
      </div>

      {includes && (
        <div className="mt-6 flex items-start gap-2 border-t border-white/10 pt-4 text-xs text-cream/60">
          <Scissors className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
          <span>Includes {includes}</span>
        </div>
      )}
    </div>
  );
}

export function DeniedPanel({ result, eyebrow }: { result: PanelResult; eyebrow?: string }) {
  return (
    <div className="card-lux mt-8 border-red-500/30 p-6 text-left md:p-8">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-red-400/40 bg-red-500/15 text-red-300">
          <X className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-3xl md:text-4xl">Membership not found</div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-red-300/80">
            {eyebrow ?? `${result.first_name ? `${result.first_name} · ` : ""}checked in ${fmtTime(new Date())}`}
          </div>
        </div>
      </div>

      <div className="mt-6 h-px w-full bg-white/10" />

      <p className="mt-5 text-sm text-cream/70">
        We couldn't find a membership for this code. Please see the front desk to register or check your membership.
      </p>
    </div>
  );
}

export function ExpiredPanel({ result, variant, cardReady, onResubscribe, onRenew, eyebrow }: {
  result: PanelResult; variant: "expired" | "no_membership"; cardReady: boolean;
  onResubscribe: () => void; onRenew: () => void; eyebrow?: string;
}) {
  const plan = planFor(result.plan_id, result.tier);
  const noMembership = variant === "no_membership";
  const lapsedDays = result.current_period_end ? -daysFrom(result.current_period_end) : null;
  return (
    <div className="card-lux mt-8 border-gold/40 p-6 text-left md:p-8">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-gold/50 bg-gold/15 text-gold">
          <X className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-3xl md:text-4xl gold-text">{noMembership ? "No membership on file" : "Expired"}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-gold/80">
            {eyebrow ?? `${result.first_name ? `${result.first_name} · ` : ""}checked in ${fmtTime(new Date())}`}
          </div>
        </div>
      </div>

      <div className="mt-6 h-px w-full bg-white/10" />

      {noMembership ? (
        <p className="mt-5 text-sm text-cream/70">
          We found this member's details but no membership is on file. Renew at the desk to activate one.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
          <Stat label="Last plan" value={plan?.name ?? (result.tier ? `${result.tier} Unlimited` : "—")} />
          <Stat
            label="Lapsed"
            value={
              result.current_period_end
                ? `${new Date(result.current_period_end).toLocaleDateString()} · ${lapsedDays} day${lapsedDays === 1 ? "" : "s"} ago`
                : "Needs review"
            }
          />
          <Stat
            label="Member since"
            value={
              result.member_since
                ? new Date(result.member_since).toLocaleDateString(undefined, { month: "short", year: "numeric" })
                : "—"
            }
          />
          <Stat label="Visits this month" value={String(result.visits_this_month ?? 0)} />
        </div>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRenew}
          disabled={!result.customer_id}
          className="btn-gold w-full disabled:opacity-40 sm:w-auto sm:px-10"
        >
          Renew
        </button>
        <button
          type="button"
          onClick={onResubscribe}
          disabled={!cardReady || !result.customer_id}
          className="w-full rounded-sm border border-gold/50 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold transition hover:bg-gold/10 disabled:opacity-40 sm:w-auto"
        >
          Set up auto-renewing plan
        </button>
      </div>
      {!cardReady && (
        <p className="mt-3 text-xs text-cream/50">
          Card payments are not configured — cash renewals still work.
        </p>
      )}
    </div>
  );
}

export function ResubscribeFlow({ customerId, firstName, currentTier, billingDay, onCancel, onReactivated }: {
  customerId: string;
  billingDay?: number | null;
  firstName: string | null;
  currentTier: string | null;
  onCancel: () => void;
  onReactivated: () => void;
}) {
  const resubFn = useServerFn(resubscribeMember);
  const [planId, setPlanId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const plan = getMemberships().find((m) => m.id === planId) ?? null;

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onReactivated, 1600);
    return () => clearTimeout(t);
  }, [done, onReactivated]);

  if (done) {
    return (
      <div className="card-lux mt-8 border-emerald-500/40 p-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
          <Check className="h-8 w-8" />
        </span>
        <div className="mt-6 font-display text-3xl">Reactivated</div>
        <p className="mt-2 text-sm text-cream/60">Bringing up the membership…</p>
      </div>
    );
  }

  return (
    <div className="card-lux mt-8 border-gold/30 p-6 text-left md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="eyebrow text-gold">{plan ? "Payment" : "Choose a plan"}</div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-cream/50 hover:text-gold"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>

      {err && <div className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}

      {!plan ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {getMemberships().filter((m) => m.interval === "monthly").map((m) => {
              const previous = (currentTier ?? "").toLowerCase() === m.tier.toLowerCase();
              return (
                <button key={m.id} type="button" onClick={() => { setErr(null); setPlanId(m.id); }}
                  className={"flex flex-col rounded-sm border p-4 text-left transition " +
                    (previous ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/[0.02] hover:border-gold/50")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-gold">{m.tier}</span>
                    {previous && <span className="text-[9px] uppercase tracking-[0.2em] text-cream/50">Previous</span>}
                  </div>
                  <div className="mt-2 font-numeric text-2xl font-semibold gold-text">{m.price}</div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-cream/50">{m.cadence}</div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
              <CreditCard className="h-4 w-4" />
            </span>
            <div className="text-sm leading-6 text-cream/75">
              Resubscribing {firstName ?? "this member"} to <span className="text-gold">{plan.name}</span>
              {` · ${plan.price} ${plan.cadence}`}.
            </div>
          </div>
          <p className="mt-4 rounded-sm border border-gold/30 bg-gold/5 p-3 text-xs leading-5 text-cream/70">
            {joinChargeText(plan, billingDayForNewMembership())}
          </p>
          <div className="mt-5">
            <SquareCardForm
              buttonLabel={`Pay $${(joinChargeQuote(new Date(), billingDayForNewMembership(), plan).totalCents / 100).toFixed(2)}`}
              amountCents={joinChargeQuote(new Date(), billingDayForNewMembership(), plan).totalCents}
              cardholder={firstName ?? "Member"}
              onError={setErr}
              onToken={async ({ source_id, verification_token }) => {
                setErr(null);
                await resubFn({ data: { customer_id: customerId, plan_id: plan.id, source_id, verification_token } });
                setDone(true);
              }}
            />
          </div>
          <div className="mt-5 text-right text-[10px] uppercase tracking-[0.24em] text-cream/40">Secured by Square</div>
        </div>
      )}
    </div>
  );
}

/** The member's stored billing day, or the day a brand-new membership would get. */
function dayFor(billingDay?: number | null): BillingDay {
  return billingDay == null ? billingDayForNewMembership() : toBillingDay(billingDay);
}

function RenewDatePill({ step, currentPeriodEnd, needsReview, billingDay }: {
  billingDay?: number | null;
  step: "method" | "cash" | "card";
  currentPeriodEnd: string | null;
  needsReview?: boolean;
}) {
  const date = !needsReview && currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString(undefined, DATE_FMT) : null;
  let text = "";
  if (step === "method") text = date ? `Renewal date: ${date}` : "Renewal date: —";
  else if (step === "cash") text = date ? `Renewal due: ${date}` : "Renewal due: —";
  else text = `Next billing: ${nextBillingDate(dayFor(billingDay)).toLocaleDateString(undefined, DATE_FMT)}`;
  return (
    <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-cream/70">
      {text}
    </div>
  );
}


/** Two-step in-shop renewal: pick a plan, then cash at the desk or card on auto-billing (renews on the member's billing day). */
export function RenewFlow({ customerId, firstName, currentTier, currentPlanId, currentPeriodEnd, needsReview, billingDay, onCancel, onDone }: {
  customerId: string;
  billingDay?: number | null;
  firstName: string | null;
  currentTier: string | null;
  currentPlanId: string | null;
  currentPeriodEnd: string | null;
  needsReview?: boolean;
  onCancel: () => void;
  onDone: () => void;
}) {
  const renewFn = useServerFn(renewMembership);
  const resubFn = useServerFn(resubscribeMember);

  const [planId, setPlanId] = useState<string | null>(currentPlanId);
  const [step, setStep] = useState<"plan" | "method" | "cash" | "card">("plan");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const plan = getMemberships().find((m) => m.id === planId) ?? null;

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [done, onDone]);

  async function payCash() {
    if (!plan || !receiptPath) return;
    setBusy(true); setErr(null);
    try {
      const r = await renewFn({ data: { customer_id: customerId, plan_id: plan.id, payment_method: "cash", receipt_photo_path: receiptPath } });
      setDone(new Date(r.current_period_end).toLocaleDateString());
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  function startCard() {
    if (!plan) return;
    setErr(null);
    setStep("card");
  }

  if (done) {
    return (
      <div className="card-lux mt-8 border-emerald-500/40 p-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
          <Check className="h-8 w-8" />
        </span>
        <div className="mt-6 font-display text-3xl">Renewed</div>
        <p className="mt-2 text-sm text-cream/70">{firstName ?? "Member"} is active through {done}.</p>
      </div>
    );
  }

  return (
    <div className="card-lux mt-8 border-gold/30 p-6 text-left md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="eyebrow text-gold">
          {step === "plan" ? "Renew · choose a plan" : step === "method" ? "Renew · payment method" : step === "cash" ? "Renew · cash receipt" : "Renew · card payment"}
        </div>
        <button
          type="button"
          onClick={step === "plan" ? onCancel : () => { setStep("plan"); setErr(null); }}
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-cream/50 hover:text-gold"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> {step === "plan" ? "Cancel" : "Back"}
        </button>
      </div>

      {err && <div className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}

      {step === "plan" && (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {getMemberships().filter((m) => m.interval === "monthly").map((m) => {
              const previous = (currentTier ?? "").toLowerCase() === m.tier.toLowerCase();
              return (
                <button key={m.id} type="button" onClick={() => { setPlanId(m.id); setStep("method"); }}
                  className={"flex flex-col rounded-sm border p-4 text-left transition " +
                    (previous ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/[0.02] hover:border-gold/50")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-gold">{m.tier}</span>
                    {previous && <span className="text-[9px] uppercase tracking-[0.2em] text-cream/50">Current</span>}
                  </div>
                  <div className="mt-2 font-numeric text-2xl font-semibold gold-text">{m.price}</div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-cream/50">{m.cadence}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === "method" && plan && (
        <>
          <p className="mt-5 text-sm text-cream/75">
            Renewing {firstName ?? "this member"} on <span className="text-gold">{plan.name}</span> · {plan.price} {plan.cadence}.
          </p>
          <RenewDatePill step="method" currentPeriodEnd={currentPeriodEnd} needsReview={needsReview} billingDay={billingDay} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => { setErr(null); setStep("cash"); }} disabled={busy}
              className="flex items-center gap-3 rounded-sm border border-white/10 bg-white/[0.02] p-5 text-left transition hover:border-gold/50 disabled:opacity-50">
              <Banknote className="h-5 w-5 text-gold" />
              <span>
                <span className="block text-sm text-cream">Cash</span>
                <span className="block text-[10px] uppercase tracking-[0.2em] text-cream/50">Taken at the desk · receipt photo required</span>
              </span>
            </button>
            <button type="button" onClick={startCard} disabled={busy}
              className="flex items-center gap-3 rounded-sm border border-emerald-400/40 bg-emerald-500/10 p-5 text-left transition hover:border-emerald-300 disabled:opacity-50">
              <CreditCard className="h-5 w-5 text-emerald-300" />
              <span>
                <span className="block text-sm text-cream">Card on auto-billing</span>
                <span className="block text-[10px] uppercase tracking-[0.2em] text-cream/50">Full price + tax today · renews on the {billingDayLabel(billingDayForNewMembership())}</span>
              </span>
            </button>
          </div>
          {busy && (
            <div className="mt-5 flex items-center gap-2 text-sm text-cream/60">
              <Loader2 className="h-4 w-4 animate-spin" /> Working…
            </div>
          )}
        </>
      )}

      {step === "cash" && plan && (
        <>
          <p className="mt-5 text-sm text-cream/75">
            Cash renewal for {firstName ?? "this member"} · <span className="text-gold">{plan.name}</span> {plan.price} {plan.cadence}.
          </p>
          <RenewDatePill step="cash" currentPeriodEnd={currentPeriodEnd} needsReview={needsReview} billingDay={billingDay} />
          <ReceiptCapture customerId={customerId} path={receiptPath} onChange={setReceiptPath} onError={setErr} />
          <button type="button" onClick={payCash} disabled={busy || !receiptPath}
            className="btn-gold mt-6 w-full disabled:opacity-40">
            {busy ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Recording…</> : "Confirm renewal"}
          </button>
          {!receiptPath && (
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-cream/40">Attach the receipt photo to continue</p>
          )}
        </>
      )}

      {step === "card" && plan && (
        <div className="mt-5">
          <RenewDatePill step="card" currentPeriodEnd={currentPeriodEnd} needsReview={needsReview} billingDay={billingDay} />
          <div className="mt-4 text-sm leading-6 text-cream/75">
            {joinChargeText(plan, billingDayForNewMembership())}
          </div>

          <div className="mt-5">
            <SquareCardForm
              buttonLabel={`Pay $${(joinChargeQuote(new Date(), billingDayForNewMembership(), plan).totalCents / 100).toFixed(2)}`}
              amountCents={joinChargeQuote(new Date(), billingDayForNewMembership(), plan).totalCents}
              cardholder={firstName ?? "Member"}
              onError={setErr}
              onToken={async ({ source_id, verification_token }) => {
                setErr(null);
                const r = await resubFn({
                  data: { customer_id: customerId, plan_id: plan.id, source_id, verification_token },
                });
                setDone(r.next_billing_at ? new Date(r.next_billing_at).toLocaleDateString() : `the ${billingDayLabel(dayFor(billingDay))}`);
              }}
            />
          </div>
          <div className="mt-5 text-right text-[10px] uppercase tracking-[0.24em] text-cream/40">Secured by Square</div>
        </div>
      )}
    </div>
  );
}

/** Full first-period charge and signup-day renewal, matching the server. */
function joinChargeText(plan: { amountCents: number; billingInterval: "month" | "year"; price: string }, day: BillingDay): string {
  const q = joinChargeQuote(new Date(), day, plan);
  const today = `$${(q.amountCents / 100).toFixed(2)} + tax today`;
  const date = q.startDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return q.annual
    ? `${today} for the full year, then ${plan.price} + tax on ${date} and every year after.`
    : `${today}, then ${plan.price} + tax on the ${billingDayLabel(q.billingDay)} of each month${q.billingDay > 28 ? " (last day in shorter months)" : ""}. Next billing: ${date}.`;
}
