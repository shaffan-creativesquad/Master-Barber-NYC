/**
 * Member self-service account data.
 *
 * A member signs in with a one-time email link. Their auth email is matched to
 * the `customers` row on the server, so a signed-in visitor only ever sees the
 * membership attached to their own verified email address.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toBillingDay } from "@/lib/billing-proration";
import { escapeLike } from "@/lib/escape-like";

export type AccountResult =
  | { found: false; email: string }
  | {
      found: true;
      email: string;
      first_name: string;
      last_name: string;
      phone: string | null;
      member_code: string | null;
      photo_url: string | null;
      member_since: string;
      visits: number;
      membership: {
        plan_id: string;
        tier: string;
        status: string;
        source: string | null;
        current_period_end: string | null;
        needs_review: boolean;
        stripe_subscription_id: string | null;
        square_subscription_id: string | null;
        billing_day: number;
      } | null;
      appointment: { starts_at: string; barber_name: string | null; service_name: string | null } | null;
    };

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountResult> => {
    const email = String(context.claims["email"] ?? "").trim().toLowerCase();
    if (!email) return { found: false, email: "" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, email, phone, member_code, photo_url, created_at")
      .ilike("email", escapeLike(email))
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!customer) return { found: false, email };

    const [{ data: membership }, { count: visits }, { data: appts }] = await Promise.all([
      supabaseAdmin
        .from("memberships")
        .select(
          "plan_id, tier, status, source, current_period_end, needs_review, stripe_subscription_id, square_subscription_id, billing_day, created_at",
        )
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .eq("result", "approved"),
      supabaseAdmin
        .from("appointments")
        .select("starts_at, barbers(name), services(name)")
        .eq("customer_id", customer.id)
        .gte("starts_at", new Date().toISOString())
        .in("status", ["pending", "confirmed"])
        .order("starts_at", { ascending: true })
        .limit(1),
    ]);

    const appt = appts?.[0] as
      | { starts_at: string; barbers: { name: string } | null; services: { name: string } | null }
      | undefined;

    return {
      found: true,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone ?? null,
      member_code: customer.member_code ?? null,
      photo_url: customer.photo_url ?? null,
      member_since: customer.created_at,
      visits: visits ?? 0,
      membership: membership
        ? {
            plan_id: membership.plan_id,
            tier: membership.tier,
            status: membership.status,
            source: membership.source ?? null,
            current_period_end: membership.current_period_end,
            needs_review: membership.needs_review === true,
            stripe_subscription_id: membership.stripe_subscription_id ?? null,
            square_subscription_id: membership.square_subscription_id ?? null,
            billing_day: toBillingDay(membership.billing_day),
          }
        : null,
      appointment: appt
        ? {
            starts_at: appt.starts_at,
            barber_name: appt.barbers?.name ?? null,
            service_name: appt.services?.name ?? null,
          }
        : null,
    };
  });

/**
 * Imported / manual members: attach a card and start their Square subscription.
 *
 * Nothing is charged now — the member's current period is already paid for.
 * The subscription simply starts on the member's billing day on or after their renewal date,
 * and Square bills the card automatically from then on.
 */
export const setupMyAutoBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        source_id: z.string().min(1),
        verification_token: z.string().optional().nullable(),
        plan_id: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const email = String(context.claims["email"] ?? "").trim().toLowerCase();
    if (!email) throw new Error("You need to sign in again.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, email, phone")
      .ilike("email", escapeLike(email))
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!customer) throw new Error("We could not find your membership.");

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("id, plan_id, tier, current_period_end, square_subscription_id, stripe_subscription_id, billing_day")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!membership) throw new Error("We could not find your membership.");
    if (membership.square_subscription_id) throw new Error("Auto-billing is already set up on this membership.");
    const { data: liveSubs } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("customer_id", customer.id)
      .not("square_subscription_id", "is", null)
      .in("status", ["active", "past_due"])
      .limit(1);
    if (liveSubs && liveSubs.length > 0) throw new Error("Auto-billing is already set up on this membership.");

    const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();
    const plan =
      MEMBERSHIPS.find((m) => m.id === (data.plan_id ?? membership.plan_id)) ??
      MEMBERSHIPS.find((m) => m.tier === membership.tier);
    if (!plan) throw new Error("Please choose your plan before saving a card.");

    const { ensureSquareCustomer, saveCardOnFile, ensurePlanVariation, createAnchoredSubscription, nextBillingDate } =
      await import("@/lib/square.server");

    const squareCustomerId = await ensureSquareCustomer({
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email.toLowerCase(),
      phone: customer.phone ?? "",
    });

    const card = await saveCardOnFile({
      sourceId: data.source_id,
      customerId: squareCustomerId,
      cardholderName: `${customer.first_name} ${customer.last_name}`.trim(),
      verificationToken: data.verification_token ?? null,
    });

    const planVariationId = await ensurePlanVariation({
      id: plan.id,
      name: plan.name,
      amountCents: plan.amountCents,
      billingInterval: plan.billingInterval,
    });

    // Start on the member's billing day on or after the period they already paid for,
    // but never in the past (lapsed members start at the next upcoming billing day).
    const now = new Date();
    const paidThrough = membership.current_period_end ? new Date(membership.current_period_end) : now;
    const valid = Number.isNaN(paidThrough.getTime()) ? now : paidThrough;
    const base = valid.getTime() > now.getTime() ? valid : now;
    const { toBillingDay } = await import("@/lib/billing-proration");
    const billingDay = toBillingDay(membership.billing_day);
    const start = nextBillingDate(billingDay, new Date(base.getTime() - 24 * 60 * 60 * 1000));

    const subscription = await createAnchoredSubscription({
      billingDay,
      customerId: squareCustomerId,
      cardId: card.id,
      planVariationId,
      billingInterval: plan.billingInterval,
      startDate: start,
      idempotencyKey: `setup-${membership.id}-${start.toISOString().slice(0, 10)}`,
    });

    await supabaseAdmin
      .from("customers")
      .update({ square_customer_id: squareCustomerId, square_card_id: card.id })
      .eq("id", customer.id);

    await supabaseAdmin
      .from("memberships")
      .update({
        plan_id: plan.id,
        tier: plan.tier,
        status: "active",
        source: "square",
        square_customer_id: squareCustomerId,
        square_subscription_id: subscription.id,
        square_card_id: card.id,
        last_payment_method: "card",
        needs_review: false,
        current_period_end: start.toISOString(),
      })
      .eq("id", membership.id);

    return {
      next_billing_at: start.toISOString(),
      card_last4: card.last4,
      plan_name: plan.name,
      amount_cents: plan.amountCents,
      billing_day: billingDay,
    };
  });

async function customerForClaims(claims: Record<string, unknown>) {
  const email = String(claims["email"] ?? "").trim().toLowerCase();
  if (!email) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("customers")
    .select("id, first_name, last_name, email, phone")
    .ilike("email", escapeLike(email))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Contact details for prefilling /book. Null when the email has no customer row. */
export const getMyBookingProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await customerForClaims(context.claims as Record<string, unknown>);
    if (!c) return null;
    return { first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone ?? "" };
  });

export type MyAppointment = {
  id: string;
  starts_at: string;
  status: string;
  service_name: string | null;
  barber_name: string | null;
  location_name: string | null;
};

/** Upcoming + last 20 past appointments, strictly for the signed-in customer. */
export const getMyAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ upcoming: MyAppointment[]; past: MyAppointment[] }> => {
    const c = await customerForClaims(context.claims as Record<string, unknown>);
    if (!c) return { upcoming: [], past: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const sel = "id, starts_at, status, services(name), barbers(name), locations(name)";
    const [up, past] = await Promise.all([
      supabaseAdmin.from("appointments").select(sel).eq("customer_id", c.id)
        .gte("starts_at", nowIso).in("status", ["pending", "confirmed"])
        .order("starts_at", { ascending: true }),
      supabaseAdmin.from("appointments").select(sel).eq("customer_id", c.id)
        .or(`starts_at.lt.${nowIso},status.eq.completed`)
        .order("starts_at", { ascending: false }).limit(20),
    ]);
    type Row = { id: string; starts_at: string; status: string; services: { name: string } | null; barbers: { name: string } | null; locations: { name: string } | null };
    const map = (r: Row): MyAppointment => ({
      id: r.id, starts_at: r.starts_at, status: r.status,
      service_name: r.services?.name ?? null, barber_name: r.barbers?.name ?? null, location_name: r.locations?.name ?? null,
    });
    return {
      upcoming: ((up.data ?? []) as unknown as Row[]).map(map),
      past: ((past.data ?? []) as unknown as Row[]).map(map),
    };
  });
