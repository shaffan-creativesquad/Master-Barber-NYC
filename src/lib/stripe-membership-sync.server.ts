import type Stripe from "stripe";
import { escapeLike } from "@/lib/escape-like";

type MembershipStatus = "active" | "past_due" | "canceled" | "incomplete";

function mapStripeStatus(status: string): MembershipStatus {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "incomplete";
}

function memberCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

/**
 * Synchronizes one Stripe subscription into the membership database.
 * This is the single write path used by checkout confirmation and webhooks.
 */
export async function syncStripeMembership(stripe: Stripe, subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
  const stripeCustomer = await stripe.customers.retrieve(customerId);
  if (stripeCustomer.deleted) throw new Error("The payment customer no longer exists.");

  const metadata = subscription.metadata ?? {};
  const email = (stripeCustomer.email ?? "").trim().toLowerCase();
  const phone = metadata.phone || stripeCustomer.phone || "";
  let firstName = metadata.first_name ?? "";
  let lastName = metadata.last_name ?? "";
  if ((!firstName || !lastName) && stripeCustomer.name) {
    const parts = stripeCustomer.name.trim().split(/\s+/);
    firstName ||= parts[0] ?? "";
    lastName ||= parts.slice(1).join(" ");
  }
  if (!email) throw new Error("The payment does not include a customer email.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
        stripe_customer_id: customerId,
        ...(!existingCustomer.member_code ? { member_code: memberCode() } : {}),
      })
      .eq("id", databaseCustomerId);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabaseAdmin
      .from("customers")
      .insert({
        first_name: firstName || "Member",
        last_name: lastName,
        email,
        phone,
        member_code: memberCode(),
        stripe_customer_id: customerId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    databaseCustomerId = created.id;
  }

  const item = subscription.items.data[0];
  const periodEnd = item?.current_period_end ?? null;
  const membership = {
    customer_id: databaseCustomerId,
    plan_id: metadata.plan_id ?? "unknown",
    tier: metadata.tier ?? metadata.plan_name ?? "Member",
    status: mapStripeStatus(subscription.status),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    source: "stripe" as const,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    last_payment_method: "card" as const,
    ...(subscription.status === "active" || subscription.status === "trialing"
      ? { last_renewed_at: new Date().toISOString(), needs_review: false }
      : {}),
  };

  const { data: linked, error: linkedError } = await supabaseAdmin
    .from("memberships")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (linkedError) throw new Error(linkedError.message);

  if (linked) {
    const { error } = await supabaseAdmin.from("memberships").update(membership).eq("id", linked.id);
    if (error) throw new Error(error.message);
  } else {
    const { data: latest } = await supabaseAdmin
      .from("memberships")
      .select("id,stripe_subscription_id")
      .eq("customer_id", databaseCustomerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest && !latest.stripe_subscription_id) {
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