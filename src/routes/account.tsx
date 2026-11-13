import { billingDayLabel, toBillingDay } from "@/lib/billing-proration";
/**
 * Member self-service account page.
 *
 * Public route: signed-out visitors get a one-time email sign-in link, signed-in
 * visitors see the membership tied to their verified email address.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccount, getMyAppointments, setupMyAutoBilling, type AccountResult, type MyAppointment } from "@/lib/account.functions";
import { formatMembershipDate } from "@/components/member-panel";
import { getMemberships, type Membership } from "@/lib/site-data";
import { SITE_IMAGES } from "@/lib/site-images";
import { PageHero } from "@/components/site/PageHero";
import { CalendarClock, Check, CreditCard, Loader2, LogOut, Mail, Scissors } from "lucide-react";
import { SquareCardForm } from "@/components/square-card";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Membership Account | Master Barber NYC" },
      {
        name: "description",
        content:
          "Sign in to see your Master Barber NYC membership: your plan, next billing date, member code and visit history.",
      },
      { property: "og:title", content: "My Membership Account | Master Barber NYC" },
      { property: "og:description", content: "Check your plan, billing date and visits at Master Barber NYC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const load = useServerFn(getMyAccount);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [data, setData] = useState<AccountResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const code = hash.get("error_code") ?? query.get("error_code");
    const desc = hash.get("error_description") ?? query.get("error_description");
    if (code || desc || hash.get("error") || query.get("error")) {
      setLinkError(
        code === "otp_expired" || /expired|invalid|not found/i.test(desc ?? "")
          ? "That sign-in link has expired or was already used. Links work once, in the same browser you requested them from. Request a fresh one below."
          : "That sign-in link didn't work. Please request a fresh one below.",
      );
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const has = !!sess.session;
    setSignedIn(has);
    if (has) {
      try {
        setData(await load());
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not load your account.");
      }
    } else {
      setData(null);
    }
    setReady(true);
  }, [load]);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return (
    <>
      <PageHero
        eyebrow="Members"
        title="My Account"
        intro="Your plan, your billing date, your visits."
        image={SITE_IMAGES.hero}
      />
      <section className="bg-ink pb-24 pt-14 text-cream">
        <div className="container-x mx-auto max-w-2xl">
          {!ready ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
            </div>
          ) : !signedIn ? (
            <SignInCard linkError={linkError} />
          ) : err ? (
            <div className="card-lux p-6 text-sm text-red-300">{err}</div>
          ) : data && data.found ? (
            <AccountCard data={data} onSignOut={refresh} />
          ) : (
            <NoMembershipCard email={data?.email ?? ""} onSignOut={refresh} />
          )}
        </div>
      </section>
    </>
  );
}

function SignInCard({ linkError }: { linkError: string | null }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0) return;
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/account` },
      });
      if (error) throw error;
      setSent(true);
      setCooldown(60);
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : "";
      const m = msg.match(/after (\d+) seconds/);
      if (m) {
        setCooldown(Number(m[1]));
        setErr("A link was just sent. Please check your inbox (and spam) before requesting another.");
      } else {
        setErr(msg || "Could not send the sign-in link.");
      }
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="card-lux p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
          <Mail className="h-6 w-6" />
        </span>
        <h2 className="mt-5 font-display text-2xl">Check your email</h2>
        <p className="mt-2 text-sm text-cream/70">
          We sent a sign-in link to {email}. Open it in this same browser — each link works once.
        </p>
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={() => setSent(false)}
          className="mt-5 text-xs uppercase tracking-[0.22em] text-cream/60 transition-colors hover:text-gold disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend available in ${cooldown}s` : "Didn't get it? Send another"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card-lux p-8">
      <h2 className="font-display text-2xl">Sign in to your membership</h2>
      <p className="mt-2 text-sm text-cream/70">
        Enter the email address on your membership. We will email you a one-time link, no password needed.
      </p>

      <label htmlFor="acct-email" className="mt-6 block text-[11px] uppercase tracking-[0.22em] text-cream/50">
        Email address
      </label>
      <input
        id="acct-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-2 w-full rounded-sm border border-white/15 bg-white/[0.03] px-4 py-3 text-cream outline-none transition-colors placeholder:text-cream/35 focus:border-gold"
        placeholder="you@email.com"
      />

      {linkError && !err && <p className="mt-3 text-sm text-amber-200">{linkError}</p>}
      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <button type="submit" disabled={busy || cooldown > 0} className="btn-gold mt-6 w-full disabled:opacity-60">
        {busy ? "Sending…" : cooldown > 0 ? `Try again in ${cooldown}s` : "Email me a sign-in link"}
      </button>
      <p className="mt-3 text-center text-[11px] uppercase tracking-[0.2em] text-cream/40">
        We respond within 24 hours if anything looks off
      </p>
    </form>
  );
}

async function signOut() {
  await supabase.auth.signOut();
}

function NoMembershipCard({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="card-lux p-8 text-center">
      <h2 className="font-display text-2xl">No membership found</h2>
      <p className="mt-2 text-sm text-cream/70">
        We could not find a membership for {email || "this email address"}. If you joined with a different email,
        sign out and try that one, or give the shop a call and we will link it up.
      </p>
      <button
        onClick={async () => {
          await signOut();
          onSignOut();
        }}
        className="mt-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-cream/60 transition-colors hover:text-gold"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

const DATE_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

function AccountCard({ data, onSignOut }: { data: Extract<AccountResult, { found: true }>; onSignOut: () => void }) {
  const m = data.membership;
  const plan = m ? getMemberships().find((p) => p.id === m.plan_id) : undefined;
  const dateInfo = m ? formatMembershipDate(m) : null;
  const active = m?.status === "active";

  return (
    <div className="space-y-6">
      <div className="card-lux p-6 md:p-8">
        <div className="flex items-center gap-4">
          <span
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border ${
              active
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                : "border-white/15 bg-white/5 text-cream/60"
            }`}
          >
            {active ? <Check className="h-7 w-7" /> : <Scissors className="h-6 w-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-3xl">
              {data.first_name} {data.last_name}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-cream/50">{data.email}</div>
          </div>
        </div>

        <div className="mt-6 h-px w-full bg-white/10" />

        <dl className="mt-6 grid grid-cols-2 gap-5">
          <Field label="Plan" value={plan?.name ?? m?.tier ?? "No active plan"} />
          <Field
            label="Status"
            value={m ? (active ? "Active" : m.status.replace("_", " ")) : "None"}
          />
          <Field label={dateInfo?.label ?? "Renewal due"} value={dateInfo?.date ?? "—"} />
          <Field label="Visits" value={String(data.visits)} />
          {data.member_code && <Field label="Member code" value={data.member_code} />}
          <Field
            label="Member since"
            value={new Date(data.member_since).toLocaleDateString(undefined, DATE_FMT)}
          />
        </dl>

        {plan && (
          <p className="mt-6 text-sm text-cream/70">
            {plan.description.replace(/, billed monthly on your signup day \(last day in shorter months\)\./, ".")} {plan.billingInterval === "year" ? "Billing renews on your signup anniversary each year." : `Billing runs on the ${billingDayLabel(toBillingDay(m?.billing_day))} of each month${toBillingDay(m?.billing_day) > 28 ? " (last day in shorter months)" : ""}.`}
          </p>
        )}
      </div>

      {m && !m.square_subscription_id && !m.stripe_subscription_id && (
        <AutoBillingCard data={data} onDone={onSignOut} />
      )}



      <AppointmentsCard />

      <div className="text-center">
        <button
          onClick={async () => {
            await signOut();
            onSignOut();
          }}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-cream/60 transition-colors hover:text-gold"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.22em] text-cream/40">{label}</dt>
      <dd className="mt-1 text-sm capitalize text-cream/90">{value}</dd>
    </div>
  );
}

/**
 * Imported members have no card in Square yet. This lets them add one so their
 * membership renews automatically on their billing day. Nothing is charged today.
 */
function AutoBillingCard({
  data,
  onDone,
}: {
  data: Extract<AccountResult, { found: true }>;
  onDone: () => void;
}) {
  const setup = useServerFn(setupMyAutoBilling);
  const m = data.membership;
  const known = getMemberships().find((p) => p.id === m?.plan_id);
  const [planId, setPlanId] = useState(known?.id ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ next_billing_at: string; card_last4: string | null } | null>(null);

  if (!m) return null;

  if (done) {
    return (
      <div className="card-lux p-6 md:p-8">
        <h3 className="font-display text-2xl">Auto-billing is on</h3>
        <p className="mt-2 text-sm text-cream/70">
          Your card{done.card_last4 ? ` ending ${done.card_last4}` : ""} is saved. Your membership renews
          automatically on {new Date(done.next_billing_at).toLocaleDateString(undefined, DATE_FMT)} and on the {billingDayLabel(toBillingDay(m.billing_day))}
          of every month after that.
        </p>
        <button onClick={onDone} className="btn-gold mt-6">
          Refresh my account
        </button>
      </div>
    );
  }

  return (
    <div className="card-lux p-6 md:p-8">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-1 h-5 w-5 shrink-0 text-gold" />
        <div>
          <h3 className="font-display text-2xl">Set up auto-billing</h3>
          <p className="mt-2 text-sm text-cream/70">
            We moved to a new payment system, so your card needs to be added once. You will not be charged today —
            your membership is paid through {data.membership?.current_period_end
              ? new Date(data.membership.current_period_end).toLocaleDateString(undefined, DATE_FMT)
              : "your current period"}
            , and billing then runs automatically on the {billingDayLabel(toBillingDay(m.billing_day))} of each month.
          </p>
        </div>
      </div>

      {!known && (
        <div className="mt-6">
          <label htmlFor="acct-plan" className="block text-[11px] uppercase tracking-[0.22em] text-cream/50">
            Your plan
          </label>
          <select
            id="acct-plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="mt-2 w-full rounded-sm border border-white/15 bg-white/[0.03] px-4 py-3 text-cream outline-none focus:border-gold"
          >
            <option value="">Select your plan…</option>
            {getMemberships().map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — ${(p.amountCents / 100).toFixed(2)}/mo
              </option>
            ))}
          </select>
        </div>
      )}

      {err && <p className="mt-4 text-sm text-red-300">{err}</p>}

      <div className="mt-6">
        <SquareCardForm
          buttonLabel="Save card & turn on auto-billing"
          intent="STORE"
          cardholder={`${data.first_name} ${data.last_name}`.trim()}
          email={data.email}
          onError={setErr}
          onToken={async ({ source_id, verification_token }) => {
            setErr(null);
            if (!known && !planId) {
              setErr("Please choose your plan first.");
              return;
            }
            const res = await setup({
              data: { source_id, verification_token, plan_id: known?.id ?? planId },
            });
            setDone({ next_billing_at: res.next_billing_at, card_last4: res.card_last4 });
          }}
        />
      </div>
      <p className="mt-3 text-center text-[11px] uppercase tracking-[0.2em] text-cream/40">
        Secure card entry — we never see your card number
      </p>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", checked_in: "Checked in",
  completed: "Completed", cancelled: "Cancelled", no_show: "No-show",
};

function AppointmentsCard() {
  const fetchAppts = useServerFn(getMyAppointments);
  const [appts, setAppts] = useState<{ upcoming: MyAppointment[]; past: MyAppointment[] } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetchAppts().then(setAppts).catch(() => setErr(true));
  }, [fetchAppts]);

  const row = (a: MyAppointment) => (
    <li key={a.id} className="flex flex-col gap-1 border-b border-white/10 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-cream">
          {new Date(a.starts_at).toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
          })}
        </div>
        <div className="text-xs text-cream/60">
          {a.service_name ?? "Visit"} · {a.barber_name ?? "Our team"} · {a.location_name ?? ""}
        </div>
      </div>
      <span className="self-start rounded-full border border-gold/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold sm:self-auto">
        {STATUS_LABEL[a.status] ?? a.status}
      </span>
    </li>
  );

  return (
    <div className="card-lux space-y-6 p-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-display text-lg text-cream">
          <CalendarClock className="h-5 w-5 text-gold" /> Appointments
        </div>
        <Link to="/book" className="btn-gold">Book an appointment</Link>
      </div>
      {err ? (
        <p className="text-cream/60">We couldn't load your appointments right now.</p>
      ) : !appts ? (
        <div className="flex items-center gap-2 text-cream/60"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/60">Upcoming</div>
            {appts.upcoming.length ? <ul>{appts.upcoming.map(row)}</ul> : <p className="py-2 text-cream/60">No upcoming appointments.</p>}
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/60">Past</div>
            {appts.past.length ? <ul>{appts.past.map(row)}</ul> : <p className="py-2 text-cream/60">No past appointments yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
