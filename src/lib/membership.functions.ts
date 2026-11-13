import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getMemberships, type Membership } from "@/lib/site-data";

/**
 * Billing rule: the first charge is the FULL plan price, taken today, on a
 * normal cycle. Only after that payment succeeds do we shift the subscription's
 * billing anchor to the 10th (see shiftAnchorToTenth) — the alignment credit or
 * charge then lands on the second invoice.
 */

const startSchema = z.object({
  plan_id: z.string().min(1),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(30),
  origin: z.string().url(),
});

export const startMembershipCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => startSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Membership payments are not configured.");
    const plan = getMemberships().find((m) => m.id === data.plan_id);
    if (!plan) throw new Error("Unknown membership plan.");

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: data.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: plan.amountCents,
            recurring: { interval: plan.billingInterval },
            product_data: {
              name: `${plan.name} Membership`,
              description: plan.description,
            },
          },
        },
      ],
      metadata: {
        plan_id: plan.id,
        plan_name: plan.name,
        tier: plan.tier,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
      },
      subscription_data: {
        metadata: { plan_id: plan.id, plan_name: plan.name, phone: data.phone },
      },
      success_url: `${data.origin}/thank-you/members/success/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/members-checkout?plan=${plan.id}`,
    });

    if (!session.url) throw new Error("Could not start checkout.");
    return { url: session.url, id: session.id };
  });

const statusSchema = z.object({ session_id: z.string().min(1) });

export const getMembershipCheckoutStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => statusSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Membership payments are not configured.");
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);
    const s = await stripe.checkout.sessions.retrieve(data.session_id);

    // Surface the member code so it can be printed onto a physical card at signup.
    let memberCode: string | null = null;
    const email = s.customer_details?.email ?? null;
    if (email) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: customer } = await supabaseAdmin
        .from("customers").select("id,member_code").eq("email", email).maybeSingle();
      if (customer) {
        memberCode = customer.member_code;
        if (!memberCode) {
          const { generateMemberCode } = await import("@/lib/members.functions");
          memberCode = generateMemberCode();
          await supabaseAdmin.from("customers").update({ member_code: memberCode }).eq("id", customer.id);
        }
      }
    }

    return {
      member_code: memberCode,
      status: s.status ?? "open",
      payment_status: s.payment_status ?? "unpaid",
      email: s.customer_details?.email ?? null,
      amount_total: s.amount_total ?? null,
      plan_id: (s.metadata?.plan_id as string | undefined) ?? null,
      plan_name: (s.metadata?.plan_name as string | undefined) ?? null,
      first_name: (s.metadata?.first_name as string | undefined) ?? null,
    };
  });

const subSchema = z.object({
  plan_id: z.string().min(1),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(30),
});

/** Creates an incomplete subscription and returns a client secret for the embedded Stripe Payment Element. */
export const createMembershipSubscription = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Membership payments are not configured.");
    const plan = getMemberships().find((m) => m.id === data.plan_id);
    if (!plan) throw new Error("Unknown membership plan.");

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);

    const customer = await stripe.customers.create({
      email: data.email,
      name: `${data.first_name} ${data.last_name}`.trim(),
      phone: data.phone,
      metadata: { plan_id: plan.id, plan_name: plan.name, tier: plan.tier },
    });

    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: plan.amountCents,
      recurring: { interval: plan.billingInterval },
      product_data: { name: `${plan.name} Membership` },
    });

    const sub = (await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        plan_id: plan.id,
        plan_name: plan.name,
        tier: plan.tier,
        phone: data.phone,
        first_name: data.first_name,
        last_name: data.last_name,
      },
      expand: ["latest_invoice.confirmation_secret", "latest_invoice.payment_intent"],
    })) as unknown as {
      id: string;
      billing_cycle_anchor?: number | null;
      items?: { data?: Array<{ current_period_end?: number }> };
      latest_invoice?: {
        amount_due?: number | null;
        confirmation_secret?: { client_secret?: string };
        payment_intent?: { client_secret?: string };
      } | null;
    };

    const clientSecret =
      sub.latest_invoice?.confirmation_secret?.client_secret ??
      sub.latest_invoice?.payment_intent?.client_secret ??
      null;

    if (!clientSecret) throw new Error("Could not start the membership payment.");

    const nextBilling = sub.items?.data?.[0]?.current_period_end ?? sub.billing_cycle_anchor ?? null;

    // Create the member record immediately. The webhook will update this same
    // row, but checkout no longer depends on webhook timing to make it visible.
    const { syncStripeMembership } = await import("@/lib/stripe-membership-sync.server");
    await syncStripeMembership(stripe, sub.id);

    return {
      client_secret: clientSecret,
      subscription_id: sub.id,
      first_charge_cents: sub.latest_invoice?.amount_due ?? plan.amountCents,
      next_billing_at: nextBilling ? new Date(nextBilling * 1000).toISOString() : null,
      interval: plan.billingInterval,
    };
  });

/**
 * Called right after the first payment succeeds: moves the renewal date to the
 * 10th. Any alignment credit/charge is applied to the next invoice.
 */
export const finalizeTenthAnchor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ subscription_id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Membership payments are not configured.");
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);
    const { shiftAnchorToTenth } = await import("@/lib/billing-anchor.server");
    try {
      const before = await stripe.subscriptions.retrieve(data.subscription_id);
      if (before.status !== "active" && before.status !== "trialing") {
        throw new Error("The payment has not completed yet. Please wait a moment and try again.");
      }
      const result = await shiftAnchorToTenth(stripe, data.subscription_id);
      const { syncStripeMembership } = await import("@/lib/stripe-membership-sync.server");
      const synced = await syncStripeMembership(stripe, data.subscription_id);
      if (synced.status !== "active") throw new Error("The membership payment is not active.");
      return { ...result, anchor_at: synced.current_period_end };
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : String(e));
    }
  });
