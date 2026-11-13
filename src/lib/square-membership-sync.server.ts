import { escapeLike } from "@/lib/escape-like";
import {
  getSquareSubscription,
  squareFetch,
  type SquareSubscription,
  firstPaidSubscriptionInvoice, SIGNUP_BILLING_SOURCE,
} from "@/lib/square.server";

type MembershipStatus = "active" | "past_due" | "canceled" | "incomplete";

/**
 * Square subscription states:
 *  PENDING     — scheduled, starts on its start_date (the member's billing day).
 *                Nothing is owed before then, so this is a live member.
 *  ACTIVE      — billing normally.
 *  PAUSED      — treated as behind on payment.
 *  CANCELED / DEACTIVATED — ended.
 */
function mapSquareStatus(status: string): MembershipStatus {
  const s = status.toUpperCase();
  if (s === "ACTIVE" || s === "PENDING") return "active";
  if (s === "PAUSED") return "past_due";
  if (s === "CANCELED" || s === "DEACTIVATED") return "canceled";
  return "incomplete";
}

/**
 * Square keeps a subscription's status ACTIVE until the paid period ends and
 * only sets canceled_date. Without this check, the next subscription.updated /
 * invoice webhook would flip a canceled membership back to active. A canceled
 * membership keeps its current_period_end (the period already paid for).
 */
export function squareSubscriptionStatus(sub: { status: string; canceled_date?: string | null }): MembershipStatus {
  if (sub.canceled_date) return "canceled";
  return mapSquareStatus(sub.status);
}

function memberCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

/** Renewal date shown to staff and members. */
function periodEndIso(sub: SquareSubscription): string | null {
  const date = sub.charged_through_date ?? sub.start_date ?? null;
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Map a Square plan variation back to the site's membership plan, so rows
 * written by the webhook show the plan name and price instead of a raw
 * Square catalog id.
 */
async function planFromVariation(variationId: string) {
  const { getMemberships, ALL_PLAN_PRICES } = await import("@/lib/site-data");
  try {
    const res = await squareFetch<{
      object?: {
        subscription_plan_variation_data?: {
          name?: string;
          phases?: Array<{ cadence?: string; pricing?: { price_money?: { amount?: number } } }>;
        };
      };
    }>(`/v2/catalog/object/${encodeURIComponent(variationId)}`);
    const phase = res.object?.subscription_plan_variation_data?.phases?.[0];
    const amount = phase?.pricing?.price_money?.amount;
    const interval = (phase?.cadence ?? "").toUpperCase() === "ANNUAL" ? "year" : "month";
    if (typeof amount !== "number") return null;
    // Match old OR new price for the same interval, regardless of today's date.
    const plan = getMemberships().find(
      (m) => m.billingInterval === interval && (ALL_PLAN_PRICES[m.id] ?? []).includes(amount),
    );
    const match = plan ? { ...plan, amountCents: amount } : undefined;
    return match ?? null;
  } catch {
    return null;
  }
}

export type SquareMemberDetails = {
  plan_id?: string;
  tier?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

/**
 * Single write path from Square into the membership tables. Used by checkout
 * confirmation and by the webhook, so both stay idempotent and consistent.
 */
export async function syncSquareMembership(
  subscriptionId: string,
  details: SquareMemberDetails = {},
) {
  const sub = await getSquareSubscription(subscriptionId);
  // New immediate-start subscriptions must be paid before any membership is written,
  // including subscription.created webhooks that race checkout.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: prior } = await supabaseAdmin.from("memberships")
    .select("id,current_period_end,refund_access_ended_at").eq("square_subscription_id", sub.id).maybeSingle();
  if (!prior && sub.source?.name === SIGNUP_BILLING_SOURCE) {
    if (sub.canceled_date || ["CANCELED", "DEACTIVATED"].includes(sub.status)) {
      throw new Error("Signup subscription was canceled before confirmation.");
    }
    if (!(await firstPaidSubscriptionInvoice(sub))) {
      throw new Error("Signup first invoice is not paid yet.");
    }
  }

  const squareCustomer = await squareFetch<{
    customer?: { id: string; email_address?: string; phone_number?: string; given_name?: string; family_name?: string };
  }>(`/v2/customers/${encodeURIComponent(sub.customer_id)}`);

  const remote = squareCustomer.customer;
  const email = (details.email ?? remote?.email_address ?? "").trim().toLowerCase();
  if (!email) throw new Error("The payment does not include a customer email.");
  const firstName = details.first_name || remote?.given_name || "Member";
  const lastName = details.last_name || remote?.family_name || "";
  const phone = details.phone || remote?.phone_number || "";

  const { data: existingCustomer, error: customerReadError } = await supabaseAdmin
    .from("customers")
    .select("id,member_code")
    .ilike("email", escapeLike(email))
    .maybeSingle();
  if (customerReadError) throw new Error(customerReadError.message);

  let databaseCustomerId: string;
  if (existingCustomer) {
    databaseCustomerId = existingCustomer.id;
    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        square_customer_id: sub.customer_id,
        ...(sub.card_id ? { square_card_id: sub.card_id } : {}),
        ...(!existingCustomer.member_code ? { member_code: memberCode() } : {}),
      })
      .eq("id", databaseCustomerId);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabaseAdmin
      .from("customers")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        member_code: memberCode(),
        square_customer_id: sub.customer_id,
        square_card_id: sub.card_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    databaseCustomerId = created.id;
  }

  const status = prior?.refund_access_ended_at ? "canceled" : squareSubscriptionStatus(sub);
  const resolved =
    details.plan_id || !sub.plan_variation_id ? null : await planFromVariation(sub.plan_variation_id);
  const membership = {
    customer_id: databaseCustomerId,
    plan_id: details.plan_id ?? resolved?.id ?? sub.plan_variation_id ?? "unknown",
    tier: details.tier ?? resolved?.tier ?? "Member",
    status,
    square_customer_id: sub.customer_id,
    square_subscription_id: sub.id,
    square_card_id: sub.card_id ?? null,
    source: "square" as const,
    current_period_end: prior?.refund_access_ended_at ?? (sub.source?.name === SIGNUP_BILLING_SOURCE && !sub.charged_through_date && sub.start_date
      ? (await import("@/lib/billing-proration")).joinChargeQuote(
          new Date(`${sub.start_date}T12:00:00Z`),
          sub.monthly_billing_anchor_date,
          { amountCents: 0, billingInterval: resolved?.billingInterval ?? (sub.monthly_billing_anchor_date ? "month" : "year") },
        ).startDate.toISOString()
      : periodEndIso(sub)),
    ...(!prior && sub.source?.name === SIGNUP_BILLING_SOURCE
      ? { billing_day: sub.monthly_billing_anchor_date ?? Number(sub.start_date?.slice(-2)) }
      : {}),
    last_payment_method: "card" as const,
    ...(status === "active" ? { last_renewed_at: new Date().toISOString(), needs_review: false } : {}),
  };

  const { data: linked, error: linkedError } = await supabaseAdmin
    .from("memberships")
    .select("id")
    .eq("square_subscription_id", sub.id)
    .maybeSingle();
  if (linkedError) throw new Error(linkedError.message);

  if (linked) {
    const { error } = await supabaseAdmin.from("memberships").update(membership).eq("id", linked.id);
    if (error) throw new Error(error.message);
  } else {
    // Customer already has a different live Square subscription: don't add a second row.
    const { data: other } = await supabaseAdmin
      .from("memberships")
      .select("id,square_subscription_id")
      .eq("customer_id", databaseCustomerId)
      .not("square_subscription_id", "is", null)
      .neq("square_subscription_id", sub.id)
      .in("status", ["active", "past_due"])
      .limit(1)
      .maybeSingle();
    if (other) {
      const reason = `Duplicate Square subscription ${sub.id} found for a customer already billed by subscription ${other.square_subscription_id}. No membership row was added. Staff: cancel the extra subscription (${sub.id}) in Square.`;
      console.error("[square-sync] duplicate_subscription", { customer_id: databaseCustomerId, existing: other.square_subscription_id, duplicate: sub.id });
      await supabaseAdmin.from("checkins").insert({
        customer_id: databaseCustomerId,
        matched_via: "manual_override",
        result: "duplicate_subscription",
        reason,
      });
      return {
        status: membership.status,
        current_period_end: membership.current_period_end,
        customer_id: databaseCustomerId,
      };
    }
    const { data: latest } = await supabaseAdmin
      .from("memberships")
      .select("id,square_subscription_id,stripe_subscription_id")
      .eq("customer_id", databaseCustomerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest && !latest.square_subscription_id && !latest.stripe_subscription_id) {
      const { error } = await supabaseAdmin.from("memberships").update(membership).eq("id", latest.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("memberships").insert(membership);
      if (error) throw new Error(error.message);
    }
  }

  return {
    status: membership.status,
    current_period_end: membership.current_period_end,
    customer_id: databaseCustomerId,
  };
}
