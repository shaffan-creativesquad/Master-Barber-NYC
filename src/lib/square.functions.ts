import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getMemberships, type Membership } from "@/lib/site-data";

/** Public Square values the browser card form needs. */
export const getSquareConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { squareWebSdkUrl, squareEnvironment } = await import("@/lib/square.server");
  return {
    application_id: process.env["SQUARE_APPLICATION_ID"] ?? "",
    location_id: process.env["SQUARE_LOCATION_ID"] ?? "",
    sdk_url: squareWebSdkUrl(),
    environment: squareEnvironment(),
  };
});

const membershipSchema = z.object({
  plan_id: z.string().min(1),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(30),
  source_id: z.string().min(1),
  verification_token: z.string().optional().nullable(),
  tip_cents: z.number().int().min(0).max(50000).optional().default(0),
});

/**
 * Membership signup on Square.
 *
 * 1. Save the card on file against a Square customer.
 * 2. Square charges the full first period (+ tax) today through its subscription.
 *    Monthly renewals follow the signup day; annual renewals follow its anniversary.
 */

export const createSquareMembership = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => membershipSchema.parse(d))
  .handler(async ({ data }) => {
    const plan = getMemberships().find((m) => m.id === data.plan_id);
    if (!plan) throw new Error("Unknown membership plan.");

    const {
      ensureSquareCustomer,
      saveCardOnFile,
      startMembershipBilling,
    } = await import("@/lib/square.server");
    const { billingDayForNewMembership, billingDayLabel } = await import("@/lib/billing-proration");
    const billingDay = billingDayForNewMembership();

    const customerId = await ensureSquareCustomer({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
    });

    const card = await saveCardOnFile({
      sourceId: data.source_id,
      customerId,
      cardholderName: `${data.first_name} ${data.last_name}`.trim(),
      verificationToken: data.verification_token ?? null,
    });

    const billing = await startMembershipBilling({
      customerId,
      cardId: card.id,
      plan: { id: plan.id, name: plan.name, amountCents: plan.amountCents, billingInterval: plan.billingInterval },
      billingDay,
    });
    const subscription = billing.subscription;
    const start = billing.nextBillingAt;
    const firstCharge = { amountCents: billing.firstChargeCents, prorated: billing.prorated };

    const { syncSquareMembership } = await import("@/lib/square-membership-sync.server");
    const synced = await syncSquareMembership(subscription.id, {
      plan_id: plan.id,
      tier: plan.tier,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("memberships")
      .update({ billing_day: billing.billingDay, current_period_end: start.toISOString(), first_payment_id: billing.paymentId, ...(data.tip_cents > 0 ? { tip_cents: data.tip_cents } : {}) })
      .eq("square_subscription_id", subscription.id);
    const { data: customerRow } = await supabaseAdmin
      .from("customers")
      .select("member_code")
      .eq("id", synced.customer_id)
      .maybeSingle();

    // Catch the first-invoice webhook arriving before tip_cents was saved.
    // The same invoice-based idempotency key prevents charging this tip twice.
    if (data.tip_cents > 0) {
      const { chargeMembershipTip } = await import("@/lib/membership-tip.server");
      await chargeMembershipTip(subscription.id, billing.firstInvoiceId).catch((error) =>
        console.error("First membership tip charge failed", subscription.id, error),
      );
    }
    // Next charge: one month or one year after signup.
    const nextBillingAt = start.toISOString();
    const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
    const todayStr = `$${(firstCharge.amountCents / 100).toFixed(2)}`;

    // Order confirmation email — never let a delivery issue fail the signup.
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("membership-confirmation", data.email.trim().toLowerCase(), {
        templateData: {
          firstName: data.first_name.trim(),
          planName: plan.name,
          amount: plan.billingInterval === "year"
            ? `${todayStr} today (incl. tax) — renews at $${(plan.amountCents / 100).toFixed(2)} + 8.875% tax on ${fmtDate(start)}`
            : `${todayStr} today (incl. tax) — then $${(plan.amountCents / 100).toFixed(2)} + 8.875% tax on ${fmtDate(start)} and on the ${billingDayLabel(billing.billingDay)} of each month${billing.billingDay > 28 ? " (last day in shorter months)" : ""}`,
          interval: plan.billingInterval,
          nextBillingDate: new Date(nextBillingAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "America/New_York",
          }),
          memberCode: customerRow?.member_code ?? "",
          cardLast4: card.last4 ?? "",
          accountUrl: "https://masterbarbernyc.com/account",
        },
        idempotencyKey: `membership-confirmation-${subscription.id}`,
      });
    } catch (error) {
      console.error("Membership confirmation email failed", error);
    }

    // Shop alert for the new membership.
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const fullName = `${data.first_name} ${data.last_name}`.trim();
      await sendTemplateEmail("shop-notification", "", {
        templateData: {
          kind: "membership",
          title: `New membership: ${fullName} — ${plan.name}`,
          details: [
            { label: "Customer", value: fullName },
            { label: "Phone", value: data.phone.trim() },
            { label: "Email", value: data.email.trim().toLowerCase() },
            { label: "Plan", value: `${plan.name} · $${(plan.amountCents / 100).toFixed(2)}/${plan.billingInterval === "year" ? "yr" : "mo"}` },
            { label: "Charged today", value: `${todayStr} (incl. tax)` },
            { label: "Monthly tip", value: data.tip_cents > 0 ? `$${(data.tip_cents / 100).toFixed(2)}` : "None" },
            { label: "Next billing", value: fmtDate(nextBillingAt) },
            { label: "Billing schedule", value: plan.billingInterval === "year" ? "Signup anniversary each year" : `The ${billingDayLabel(billing.billingDay)} of each month${billing.billingDay > 28 ? " (last day in shorter months)" : ""}` },
            { label: "Card on file", value: card.last4 ? `•••• ${card.last4}` : "" },
            { label: "Member code", value: customerRow?.member_code ?? "" },
          ],
        },
        replyTo: data.email.trim().toLowerCase(),
        idempotencyKey: `shop-membership-${subscription.id}`,
      });
    } catch (error) {
      console.error("Shop membership alert failed", error);
    }

    return {
      subscription_id: subscription.id,
      payment_id: billing.paymentId,
      first_charge_cents: firstCharge.amountCents,
      prorated: firstCharge.prorated,
      recurring_cents: plan.amountCents,
      next_billing_at: nextBillingAt,
      interval: plan.billingInterval,
      billing_day: billing.billingDay,
      card_last4: card.last4,
      member_code: customerRow?.member_code ?? null,
    };
  });


const bookingCardSchema = z.object({
  source_id: z.string().min(1),
  verification_token: z.string().optional().nullable(),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(30),
});

/**
 * Booking flow: store a card on file so a cancellation or no-show fee can be
 * charged later. Nothing is charged now.
 */
export const saveBookingCard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bookingCardSchema.parse(d))
  .handler(async ({ data }) => {
    const { ensureSquareCustomer, saveCardOnFile } = await import("@/lib/square.server");
    const customerId = await ensureSquareCustomer({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
    });
    const card = await saveCardOnFile({
      sourceId: data.source_id,
      customerId,
      cardholderName: `${data.first_name} ${data.last_name}`.trim(),
      verificationToken: data.verification_token ?? null,
    });
    return { square_customer_id: customerId, square_card_id: card.id, card_last4: card.last4 };
  });
