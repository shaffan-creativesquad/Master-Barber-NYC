import { TipPicker } from "@/components/tip-picker";
import { CHECKIN_TIP_BASE_CENTS } from "@/lib/site-data";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { checkInMember, getMemberPanel, listCheckInBarbers, manualOverrideCheckIn } from "@/lib/members.functions";
import { getSquareConfig } from "@/lib/square.functions";
import { ApprovedPanel, DeniedPanel, ExpiredPanel, MemberPhoto, RenewFlow, ResubscribeFlow, planFor } from "@/components/member-panel";
import { SquareCardForm } from "@/components/square-card";
import { Banknote, Check, CreditCard, Loader2, ShieldAlert, X } from "lucide-react";

type Barber = { id: string; name: string; photo_url: string | null; specialty: string | null };


function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export const Route = createFileRoute("/_authenticated/validator/")({
  head: () => ({
    meta: [
      { title: "Check-In Kiosk | Admin | Master Barber NYC" },
      { name: "description", content: "Scan a member card or enter a phone number to verify membership." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckinPage,
});

type Result = Awaited<ReturnType<typeof checkInMember>>;

function CheckinPage() {
  const checkFn = useServerFn(checkInMember);
  const overrideFn = useServerFn(manualOverrideCheckIn);
  const panelFn = useServerFn(getMemberPanel);
  const configFn = useServerFn(getSquareConfig);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [staffPanel, setStaffPanel] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDone, setOverrideDone] = useState(false);
  const [resub, setResub] = useState(false);
  const [renew, setRenew] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [pending, setPending] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Barber + tip selections made inside the confirm popup
  const barbersFn = useServerFn(listCheckInBarbers);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [tipCents, setTipCents] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [tipMethod, setTipMethod] = useState<"card" | "cash" | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);

  const focus = () => inputRef.current?.focus();
  useEffect(() => { focus(); }, []);

  useEffect(() => {
    configFn()
      .then((c) => setCardReady(!!c.application_id && !!c.location_id))
      .catch(() => setCardReady(false));
    barbersFn()
      .then((r) => setBarbers(r.barbers as Barber[]))
      .catch(() => setBarbers([]));
  }, [configFn, barbersFn]);

  function resetTip() {
    setBarberId(null); setTipCents(0); setCustomTip(""); setTipMethod(null); setTipError(null);
  }

  function reset() {
    setResult(null); setPending(null); setConfirming(false); setStaffPanel(false); setOverrideReason(""); setOverrideDone(false); setResub(false); setRenew(false); resetTip(); focus();
  }

  useEffect(() => {
    if (!result || resub || renew || pending) return;
    const t = setTimeout(reset, 8000);
    return () => clearTimeout(t);
  }, [result, resub, renew, pending]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = value.trim();
    if (!code || busy) return;
    setBusy(true); setErr(null); setResult(null); setPending(null); setOverrideDone(false); setStaffPanel(false); setResub(false); setRenew(false); resetTip();
    try {
      const r = await checkFn({ data: { code, confirm: false } });
      setPending({ ...r, code } as Result & { code: string });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false); setValue(""); focus();
    }
  }

  const hasSavedCard = pending?.has_saved_card === true;
  /** Staff always says whether the tip is cash or card, even with a card on file. */
  const tipNeedsMethod = tipCents > 0 && !tipMethod;
  const needsCardEntry = tipCents > 0 && !hasSavedCard && tipMethod === "card";
  /** Only require a barber when there are barbers to pick from. */
  const barberRequired = !!pending?.customer_id && barbers.length > 0;
  const canConfirm = (!barberRequired || !!barberId) && !tipNeedsMethod;

  /** Staff taps Confirm on the popup — only then is the visit recorded. */
  async function confirmCheckIn(opts?: {
    skipTip?: boolean;
    source_id?: string;
    verification_token?: string | null;
  }) {
    const p = pending as (Result & { code?: string }) | null;
    if (!p?.code || confirming) return;
    if (!barberId && barberRequired) return;
    const amount = opts?.skipTip ? 0 : tipCents;
    setConfirming(true); setErr(null); setTipError(null);
    try {
      const r = await checkFn({
        data: {
          code: p.code,
          confirm: true,
          barber_id: barberId,
          tip_amount_cents: amount,
          tip_payment_method: amount > 0 ? tipMethod : null,
          tip_source_id: opts?.source_id ?? null,
          tip_verification_token: opts?.verification_token ?? null,
        },
      });
      if (r.tip_error) {
        setTipError(r.tip_error);
      } else {
        setPending(null);
        setResult(r);
        resetTip();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setConfirming(false);
  }


  async function doOverride() {
    if (!result?.customer_id || overrideReason.trim().length < 3) return;
    try {
      await overrideFn({ data: { customer_id: result.customer_id, reason: overrideReason.trim() } });
      setOverrideDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  /** After a successful resubscribe payment, wait for the record to sync, then show approved. */
  async function afterReactivated(customerId: string) {
    for (let i = 0; i < 8; i++) {
      try {
        const p = await panelFn({ data: { customer_id: customerId } });
        if (p.approved) {
          setResub(false);
          setResult(p as unknown as Result);
          return;
        }
      } catch { /* keep polling */ }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setResub(false);
    setErr("Payment received. The membership will appear shortly, please rescan in a moment.");
    reset();
  }

  const expired = !!result && !result.approved && result.reason_code === "expired";
  const noMembership = !!result && !result.approved && result.reason_code === "no_membership";
  const overlay = resub || renew;

  return (
    <div onClick={resub || renew ? undefined : focus} className="w-full max-w-2xl text-center">
      <div className="eyebrow">Front desk</div>
      <h1 className="mt-2 font-display text-3xl md:text-4xl">Check-In Kiosk</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-cream/60">Scan the member card barcode or type a member code / phone number.</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z0-9+]/g, "").replace(/(?!^)\+/g, ""))}
          disabled={busy}
          autoComplete="off"
          placeholder="Scan or type…"
          className="h-[52px] flex-1 rounded-sm border border-white/15 bg-black/40 px-4 text-center font-numeric text-xl tracking-[0.2em] text-cream outline-none focus:border-gold/60 sm:text-left"
        />
        <button type="submit" disabled={busy} className="btn-gold whitespace-nowrap px-8">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check in"}
        </button>
      </form>

      {err && <div className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4" onClick={reset}>
          <div className="my-auto w-full max-w-xl rounded-sm border border-white/10 bg-ink p-7 text-center"
            onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">Confirm check-in</div>
            <div className="mt-4 flex justify-center">
              <MemberPhoto url={pending.photo_url ?? null} name={pending.first_name} editable={false} size={96} />
            </div>
            <h2 className="mt-4 font-display text-2xl text-cream">{pending.first_name ?? "Member not found"}</h2>
            <p className="mt-2 text-sm text-cream/65">
              {pending.approved
                ? `${planFor(pending.plan_id, pending.tier)?.name ?? pending.tier ?? "Membership"} · active`
                : pending.staff_reason ?? pending.reason ?? "Membership not active"}
            </p>

            {pending.customer_id && (<>
            {/* Barber — staff taps whoever is taking this member */}
            <div className="mt-6 text-left">
              <div className="text-[10px] uppercase tracking-[0.24em] text-cream/45">Barber</div>
              {barbers.length === 0 ? (
                <p className="mt-2 text-xs text-cream/50">No active barbers found.</p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {barbers.map((b) => {
                    const on = barberId === b.id;
                    return (
                      <button key={b.id} type="button" onClick={() => setBarberId(b.id)}
                        className={"flex flex-col items-center gap-2 rounded-sm border p-2 transition " +
                          (on ? "border-gold bg-gold/15" : "border-white/10 bg-white/[0.02] hover:border-gold/50")}>
                        <span className="grid h-14 w-14 overflow-hidden rounded-full border border-white/15 bg-white/5 place-items-center text-xs text-cream/60">
                          {b.photo_url
                            ? <img src={b.photo_url} alt={b.name} className="h-full w-full object-cover" />
                            : b.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className={"text-xs " + (on ? "text-gold" : "text-cream/75")}>{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tip */}
            <div className="mt-6 border-t border-white/10 pt-5 text-left">
              <div className="text-[10px] uppercase tracking-[0.24em] text-cream/45">Tip (optional)</div>
              <div className="mt-3">
                <TipPicker key={pending?.customer_id ?? "tip"} baseCents={CHECKIN_TIP_BASE_CENTS} value={tipCents}
                  onChange={(c) => { setTipCents(c); if (c === 0) setTipMethod(null); setTipError(null); }}
                  percentLabel="Percent of a $42 regular haircut." />
              </div>

              {tipCents > 0 && (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => { setTipMethod("cash"); setTipError(null); }}
                      className={"flex items-center gap-3 rounded-sm border p-4 text-left transition " +
                        (tipMethod === "cash" ? "border-gold bg-gold/15" : "border-white/10 bg-white/[0.02] hover:border-gold/50")}>
                      <Banknote className="h-5 w-5 text-gold" />
                      <span className="text-sm text-cream">Cash</span>
                    </button>
                    <button type="button" onClick={() => { setTipMethod("card"); setTipError(null); }} disabled={!cardReady && !hasSavedCard}
                      className={"flex items-center gap-3 rounded-sm border p-4 text-left transition disabled:opacity-40 " +
                        (tipMethod === "card" ? "border-emerald-300 bg-emerald-500/15" : "border-white/10 bg-white/[0.02] hover:border-emerald-300/60")}>
                      <CreditCard className="h-5 w-5 text-emerald-300" />
                      <span className="text-sm text-cream">{hasSavedCard ? "Card on file" : "Card"}</span>
                    </button>
                  </div>
                  {tipMethod === "card" && hasSavedCard && (
                    <p className="mt-3 text-xs text-cream/55">
                      {money(tipCents)} will be charged to the card on file when you confirm.
                    </p>
                  )}
                  {tipMethod === "cash" && (
                    <p className="mt-3 text-xs text-cream/55">
                      {money(tipCents)} recorded as cash — no card will be charged.
                    </p>
                  )}
                </>
              )}
            </div>
            </>)}

            {tipError && (
              <div className="mt-4 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-left text-xs text-red-200">
                The tip could not be charged: {tipError}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => confirmCheckIn()} disabled={confirming}
                    className="rounded-sm border border-gold/50 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-gold hover:bg-gold/10">
                    Try again
                  </button>
                  <button type="button" onClick={() => confirmCheckIn({ skipTip: true })} disabled={confirming}
                    className="rounded-sm border border-white/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-cream/70 hover:border-gold/40 hover:text-gold">
                    Skip tip &amp; check in
                  </button>
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-cream/45">Nothing is recorded until you confirm.</p>

            {needsCardEntry ? (
              <div className="mt-5 text-left">
                <SquareCardForm
                  buttonLabel={`Charge ${money(tipCents)} tip & check in`}
                  amountCents={tipCents}
                  cardholder={pending.first_name ?? "Member"}
                  onError={setTipError}
                  onToken={async ({ source_id, verification_token }) => {
                    await confirmCheckIn({ source_id, verification_token });
                  }}
                />
                {barberRequired && !barberId && (
                  <p className="mt-2 text-center text-[10px] uppercase tracking-[0.2em] text-cream/45">Choose a barber first</p>
                )}
                <button onClick={reset} disabled={confirming}
                  className="mt-3 w-full rounded-sm border border-white/15 px-4 py-3 text-sm text-cream/70 hover:border-gold/40 hover:text-gold">
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="mt-6 flex gap-3">
                  <button onClick={reset} disabled={confirming}
                    className="flex flex-1 items-center justify-center gap-2 rounded-sm border border-white/15 px-4 py-3 text-sm text-cream/70 hover:border-gold/40 hover:text-gold">
                    <X className="h-4 w-4" /> Cancel
                  </button>
                  <button onClick={() => confirmCheckIn()} disabled={confirming || !canConfirm}
                    className="btn-gold flex flex-1 items-center justify-center gap-2 disabled:opacity-50">
                    {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Confirm check-in</>}
                  </button>
                </div>
                {!canConfirm && (
                  <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-cream/45">
                    {barberRequired && !barberId ? "Choose a barber to continue" : "Choose cash or card for the tip"}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {result && !overlay && (
        result.approved ? (
          <ApprovedPanel result={result} />
        ) : expired || noMembership ? (
          <ExpiredPanel
            result={result}
            variant={noMembership ? "no_membership" : "expired"}
            cardReady={cardReady}
            onResubscribe={() => setResub(true)}
            onRenew={() => setRenew(true)}
          />
        ) : (
          <DeniedPanel result={result} />
        )
      )}

      {result && renew && result.customer_id && (
        <RenewFlow
          customerId={result.customer_id}
          firstName={result.first_name}
          currentTier={result.tier}
          currentPlanId={result.plan_id}
          currentPeriodEnd={result.current_period_end ?? null}
          needsReview={result.needs_review === true}
          billingDay={result.billing_day ?? null}
          onCancel={reset}
          onDone={() => afterReactivated(result.customer_id!)}
        />
      )}

      {result && resub && result.customer_id && cardReady && (
        <ResubscribeFlow
          customerId={result.customer_id}
          firstName={result.first_name}
          currentTier={result.tier}
          billingDay={result.billing_day ?? null}
          onCancel={reset}
          onReactivated={() => afterReactivated(result.customer_id!)}
        />
      )}

      {result && !result.approved && !overlay && (
        <div className="mt-4 rounded-sm border border-white/10 bg-white/[0.02] p-4 text-left">
          <button
            onClick={() => setStaffPanel((s) => !s)}
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-cream/60 hover:text-gold"
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Staff panel
          </button>
          {staffPanel && (
            <div className="mt-4 space-y-3 text-sm">
              <div className="text-cream/70">{result.staff_reason}</div>
              {result.tier && (
                <div className="text-xs text-cream/50">
                  Last known plan: {planFor(result.plan_id, result.tier)?.name ?? `${result.tier} Unlimited`}
                  {result.current_period_end
                    ? ` · expired ${new Date(result.current_period_end).toLocaleDateString()}`
                    : ""}
                </div>
              )}
              {result.customer_id && (
                overrideDone ? (
                  <div className="text-emerald-300">Override logged.</div>
                ) : (
                  <>
                    <input
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Reason for manual override (required)"
                      className="w-full rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-cream outline-none focus:border-gold/60"
                    />
                    <button onClick={doOverride} disabled={overrideReason.trim().length < 3} className="btn-gold disabled:opacity-40">
                      Approve with override
                    </button>
                  </>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

