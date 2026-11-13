import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { TipPicker } from "@/components/tip-picker";
import { useServerFn } from "@tanstack/react-start";
import { createSquareMembership } from "@/lib/square.functions";
import { SquareCardForm } from "@/components/square-card";
import { PageHero } from "@/components/site/PageHero";
import { SITE_IMAGES } from "@/lib/site-images";
import { getMemberships, type Membership } from "@/lib/site-data";
import { joinChargeQuote, billingDayLabel, billingDayForNewMembership } from "@/lib/billing-proration";
import { Check, ChevronLeft, ChevronRight, Crown, Loader2, CreditCard, Sparkles, Calendar } from "lucide-react";

type Search = { plan?: string; billing?: string };

export const Route = createFileRoute("/members-checkout")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    plan: typeof search.plan === "string" ? search.plan : undefined,
    billing: typeof search.billing === "string" ? search.billing : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Join the Members Club | Master Barber NYC" },
      { name: "description", content: "Start your Master Barber NYC unlimited membership. Choose Bronze, Silver or Gold, add your details and pay securely." },
      { property: "og:title", content: "Join the Members Club | Master Barber NYC" },
      { property: "og:description", content: "Choose your unlimited membership tier and start today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MembershipCheckoutPage,
});

const LABELS = ["Membership", "Details", "Payment", "Confirmed"];

type Billing = { first_charge_cents: number | null; next_billing_at: string | null; interval: "month" | "year"; billing_day?: number };

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

/** Full signup payment and next signup-day renewal. */
function BillingNote({ billing, fullCents }: { billing: Billing | null; fullCents?: number }) {
  if (!billing) return null;
  const today = billing.first_charge_cents ?? 0;
  const next = billing.next_billing_at ? longDate(billing.next_billing_at) : null;
  const full = fullCents != null ? `${money(fullCents)} + 8.875% NYC sales tax` : "the full price + tax";
  return (
    <div className="mt-6 rounded-sm border border-gold/25 bg-gold/[0.06] p-4 text-left text-sm leading-7 text-cream/75">
      <span className="text-gold">Billing schedule:</span>{" "}
      {billing.interval === "year" ? (
        <>Today: <span className="text-cream">{money(today)}</span> for the full year. Renews at <span className="text-cream">{full}</span>{next ? <> on <span className="text-cream">{next}</span></> : null}.</>
      ) : (
        <>Today: <span className="text-cream">{money(today)}</span> including tax, then <span className="text-cream">{full}</span> on the {billingDayLabel(billing.billing_day ?? billingDayForNewMembership())} of each month{(billing.billing_day ?? billingDayForNewMembership()) > 28 ? " (last day in shorter months)" : ""}{next ? <>. Next billing: <span className="text-cream">{next}</span></> : null}.</>
      )}
    </div>
  );
}

/** Resolve "bronze" or a full id like "silver-monthly" into a real membership id. */
function resolvePlanId(raw?: string): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  const exact = getMemberships().find((m) => m.id === v);
  if (exact) return exact.id;
  const tier = getMemberships().find((m) => m.tier.toLowerCase() === v);
  return tier?.id ?? null;
}

function MembershipCheckoutPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const resolved = resolvePlanId(search.plan);

  const [planId, setPlanId] = useState<string | null>(resolved);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [billing, setBilling] = useState<Billing | null>(null);

  const plan = useMemo(() => getMemberships().find((m) => m.id === planId) ?? null, [planId]);

  function choose(id: string) {
    setPlanId(id);
    navigate({ to: "/members-checkout", search: { plan: id }, replace: true });
  }

  return (
    <>
      <PageHero
        eyebrow="Members Club"
        title={<>Join the club</>}
        intro="Confirm your membership, add your details and pay securely. No appointments to pick, your unlimited plan starts today."
        image={SITE_IMAGES.about}
      />

      <section className="bg-ink text-cream">
        <div className="container-x py-16 md:py-20">
          <Stepper step={step} />

          <div className="mx-auto mt-10 max-w-4xl">
            {step === 1 && (
              <StepMembership plan={plan} onChoose={choose} onNext={() => setStep(2)} />
            )}
            {step === 2 && plan && (
              <StepDetails plan={plan} form={form} setForm={setForm} onBack={() => setStep(1)} onNext={() => setStep(3)} />
            )}
            {step === 3 && plan && (
              <StepPayment plan={plan} form={form} onBack={() => setStep(2)} onPaid={(b) => { setBilling(b); setStep(4); }} />
            )}
            {step === 4 && plan && <StepConfirmed plan={plan} form={form} billing={billing} />}
          </div>
        </div>
      </section>
    </>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[10px] uppercase tracking-[0.24em] text-cream/50">
      {LABELS.map((l, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={l} className="flex items-center gap-2">
            <span className={"grid h-6 w-6 place-items-center rounded-full border text-[10px] " + (active ? "border-gold bg-gold text-ink" : done ? "border-gold/60 bg-gold/15 text-gold" : "border-white/15 text-cream/50")}>
              {done ? <Check className="h-3 w-3" /> : n}
            </span>
            <span className={active ? "text-gold" : done ? "text-cream/70" : ""}>{l}</span>
            {n < LABELS.length && <ChevronRight className="h-3 w-3 text-cream/25" />}
          </li>
        );
      })}
    </ol>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <div className="eyebrow text-gold">{eyebrow}</div>
      <h2 className="mt-3 font-display text-3xl md:text-4xl">{title}</h2>
    </div>
  );
}

type Plan = Membership;

function PlanSummary({ plan }: { plan: Plan }) {
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-gold">
            {plan.featured ? <Crown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em]">{plan.tier} Unlimited</span>
          </div>
          <div className="mt-3 font-display text-2xl md:text-3xl">{plan.name}</div>
          <div className="mt-2 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-cream/55">
            <Calendar className="h-3 w-3 text-gold/70" />
            {plan.interval === "annual" ? "Annual billing" : "Billed monthly"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-numeric text-4xl font-semibold gold-text">{plan.price}</div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-cream/50">{plan.cadence}</div>
        </div>
      </div>

      {plan.priceNote && <p className="mt-3 text-sm text-cream/70">{plan.priceNote}</p>}

      <p className="mt-5 text-sm leading-7 text-cream/70">{plan.description}</p>

      <ul className="mt-6 space-y-2 text-sm text-cream/70">
        {plan.perks.map((p) => (
          <li key={p} className="flex gap-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {p}
          </li>
        ))}
      </ul>

      {plan.terms && plan.terms.length > 0 && (
        <div className="mt-8 border-t border-white/10 pt-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/50">Membership terms</div>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-cream/60">
            {plan.terms.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/70" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StepMembership({ plan, onChoose, onNext }: { plan: Plan | null; onChoose: (id: string) => void; onNext: () => void }) {
  if (!plan) {
    const cards = getMemberships().filter((m) => m.interval === "monthly");
    return (
      <div>
        <SectionTitle eyebrow="Step 1" title="Choose your membership" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {cards.map((m) => (
            <button key={m.id} type="button" onClick={() => onChoose(m.id)}
              className="group flex flex-col rounded-sm border border-white/10 bg-white/[0.02] p-6 text-left transition hover:border-gold/50">
              <div className="eyebrow text-gold">{m.tier}</div>
              <div className="mt-2 font-display text-xl">{m.name}</div>
              <div className="mt-4 font-numeric text-3xl font-semibold gold-text">{m.price}</div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-cream/50">{m.cadence}</div>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-cream/65">
                {m.perks.map((p) => (
                  <li key={p} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {p}</li>
                ))}
              </ul>
              <span className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                Choose {m.tier} <ChevronRight className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle eyebrow="Step 1" title="Your membership" />
      <div className="mx-auto mt-10 max-w-2xl">
        <PlanSummary plan={plan} />
        <div className="mt-8 flex items-center justify-between gap-4">
          <Link to="/members-club" className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-cream/60 transition hover:text-gold">
            <ChevronLeft className="h-4 w-4" /> Change plan
          </Link>
          <button type="button" onClick={onNext} className="btn-gold">Continue</button>
        </div>
      </div>
    </div>
  );
}

function StepDetails({ plan, form, setForm, onBack, onNext }: {
  plan: Plan;
  form: { first_name: string; last_name: string; email: string; phone: string };
  setForm: React.Dispatch<React.SetStateAction<{ first_name: string; last_name: string; email: string; phone: string }>>;
  onBack: () => void; onNext: () => void;
}) {
  const valid =
    form.first_name.trim() && form.last_name.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && form.phone.trim().length >= 7;

  return (
    <div>
      <SectionTitle eyebrow="Step 2" title="Your details" />
      <p className="mt-4 text-center text-sm text-cream/60">
        Signing up for <span className="text-gold">{plan.name}</span> at {plan.price} {plan.cadence}.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onNext(); }} className="mx-auto mt-10 grid max-w-2xl gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" value={form.first_name} onChange={(v) => setForm((s) => ({ ...s, first_name: v }))} />
          <Field label="Last name" value={form.last_name} onChange={(v) => setForm((s) => ({ ...s, last_name: v }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" type="tel" value={form.phone} onChange={(v) => setForm((s) => ({ ...s, phone: v }))} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm((s) => ({ ...s, email: v }))} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-cream/60 hover:text-gold">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button type="submit" disabled={!valid} className="btn-gold disabled:cursor-not-allowed disabled:opacity-40">Continue to payment</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/60">{label}</span>
      <input required type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-gold focus:outline-none" />
    </label>
  );
}

function StepPayment({ plan, form, onBack, onPaid }: {
  plan: Plan;
  form: { first_name: string; last_name: string; email: string; phone: string };
  onBack: () => void; onPaid: (billing: Billing) => void;
}) {
  const createMembershipFn = useServerFn(createSquareMembership);
  const [err, setErr] = useState<string | null>(null);
  const [tipCents, setTipCents] = useState(0);

  const quote = joinChargeQuote(new Date(), billingDayForNewMembership(), plan);
  const todayLabel = `$${(quote.amountCents / 100).toFixed(2)} + tax`;
  const preview: Billing = {
    first_charge_cents: quote.totalCents,
    next_billing_at: quote.startDate.toISOString(),
    interval: plan.billingInterval,
    billing_day: quote.billingDay,
  };


  return (
    <div>
      <SectionTitle eyebrow="Step 3" title="Payment" />
      <div className="mx-auto mt-10 max-w-2xl rounded-sm border border-white/10 bg-white/[0.02] p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="text-sm leading-7 text-cream/75">
            <div className="font-display text-lg text-cream">{plan.name} · {plan.price} {plan.cadence}</div>
            {plan.billingInterval === "year"
              ? <>Today you pay {todayLabel} for the full year. It renews on {longDate(quote.startDate.toISOString())} until you cancel by calling the shop.</>
              : <>{todayLabel} today, then {plan.price} + tax on the {billingDayLabel(quote.billingDay)} of each month{quote.billingDay > 28 ? " (last day in shorter months)" : ""}. It renews automatically until you cancel by calling the shop.</>}
          </div>

        </div>

        {plan.priceNote && <p className="mt-4 text-sm text-cream/60">{plan.priceNote}</p>}

        <BillingNote billing={preview} fullCents={plan.amountCents} />

        {plan.terms && plan.terms.length > 0 && (
          <ul className="mt-6 space-y-2 border-t border-white/10 pt-6 text-xs leading-relaxed text-cream/55">
            {plan.terms.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/70" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 border-t border-white/10 pt-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/60">Monthly tip for your barber (optional)</div>
          <p className="mt-1 mb-3 text-xs text-cream/50">Added to your card each month with your membership payment. Change or stop it anytime by calling the shop.</p>
          <TipPicker baseCents={plan.amountCents} value={tipCents} onChange={setTipCents} percentLabel={`Percent of your ${plan.price}/month plan.`} />
        </div>

        {err && <div className="mt-6 rounded-sm border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>}

        <div className="mt-6">
          <SquareCardForm
            buttonLabel={`Start membership — ${money(quote.totalCents)} today`}
            amountCents={quote.totalCents}

            cardholder={`${form.first_name} ${form.last_name}`.trim()}
            email={form.email}
            onError={setErr}
            onToken={async ({ source_id, verification_token }) => {
              setErr(null);
              const res = await createMembershipFn({
                data: {
                  plan_id: plan.id,
                  first_name: form.first_name.trim(),
                  last_name: form.last_name.trim(),
                  email: form.email.trim(),
                  phone: form.phone.trim(),
                  source_id,
                  verification_token,
                  tip_cents: tipCents,
                },
              });
              onPaid({
                first_charge_cents: res.first_charge_cents,
                next_billing_at: res.next_billing_at,
                interval: res.interval,
                billing_day: res.billing_day,
              });
            }}
          />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-cream/60 hover:text-gold">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <span className="text-[10px] uppercase tracking-[0.24em] text-cream/40">Secured by Square</span>
        </div>
      </div>
    </div>
  );
}

function StepConfirmed({ plan, form, billing }: { plan: Plan; form: { first_name: string; email: string }; billing: Billing | null }) {
  return (
    <div>
      <SectionTitle eyebrow="Step 4" title="Membership confirmed" />
      <div className="mx-auto mt-10 max-w-2xl rounded-sm border border-white/10 bg-white/[0.02] p-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
          <Check className="h-7 w-7" />
        </span>
        <h3 className="mt-6 font-display text-2xl md:text-3xl">
          {form.first_name ? `Welcome, ${form.first_name}.` : "Welcome to the Members Club."}
        </h3>
        <p className="mt-4 text-sm leading-7 text-cream/70">
          Your card is saved and your <span className="text-gold">{plan.name}</span> membership is active at

          {" "}{plan.price} {plan.cadence}.{billing?.first_charge_cents != null ? ` ${money(billing.first_charge_cents)} (incl. tax) was charged today.` : ""} A confirmation is on its way to {form.email || "your inbox"}.
        </p>

        <BillingNote billing={billing} fullCents={plan.amountCents} />

        <div className="mt-8 text-left">
          <PlanSummary plan={plan} />
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/members-club" className="btn-gold">Back to Members Club</Link>
        </div>
      </div>
    </div>
  );
}
