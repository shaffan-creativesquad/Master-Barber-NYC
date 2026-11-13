import type Stripe from "stripe";

/** The day of the month every membership renews on. */
export const BILLING_DAY = 10;

/** Next occurrence of the 10th, strictly in the future. */
export function nextTenth(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  if (d.getDate() >= BILLING_DAY) {
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
  }
  d.setDate(BILLING_DAY);
  return d;
}

/**
 * Move a live subscription's billing cycle onto the 10th.
 *
 * Called only AFTER the first full-price invoice is paid, so the member never
 * gets access before paying full price once. Proration is enabled, so the
 * small credit/charge that aligns the dates lands on the SECOND invoice.
 */
export async function shiftAnchorToTenth(
  stripe: Stripe,
  subscriptionId: string,
): Promise<{ shifted: boolean; anchor_at: string | null; reason?: string }> {
  const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as {
    id: string;
    status: string;
    customer: string;
    currency?: string;
    metadata?: Record<string, string>;
    items?: { data?: Array<{ current_period_start?: number; current_period_end?: number; price?: { unit_amount?: number | null } }> };
  };

  if (sub.status !== "active" && sub.status !== "trialing") {
    return { shifted: false, anchor_at: null, reason: `subscription is ${sub.status}` };
  }

  const periodEnd = sub.items?.data?.[0]?.current_period_end ?? null;
  const anchorSeconds = Math.floor(nextTenth().getTime() / 1000);
  if (sub.metadata?.tenth_anchor_shifted === "true") {
    return {
      shifted: false,
      anchor_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      reason: "already renewing on the 10th",
    };
  }

  // Stripe forbids moving billing_cycle_anchor forward on a live subscription.
  // The documented way to change the billing date is to set trial_end: the
  // current period ends on the 10th, the unused-time credit is prorated onto
  // the NEXT invoice, and the cycle then anchors to the 10th. The first
  // full-price invoice is already paid and untouched.
  const item = sub.items?.data?.[0];
  const updated = (await stripe.subscriptions.update(subscriptionId, {
    trial_end: anchorSeconds,
    proration_behavior: "create_prorations",
    metadata: { tenth_anchor_shifted: "true" },
  }, { idempotencyKey: `membership-tenth-anchor-${subscriptionId}` })) as unknown as { items?: { data?: Array<{ current_period_end?: number }> } };

  // The credit above covers everything from today, including the days between
  // today and the 10th that the member actually uses. Bill those few days back
  // on the NEXT invoice so the alignment nets out fairly.
  const periodStart = item?.current_period_start ?? null;
  const unitAmount = item?.price?.unit_amount ?? null;
  if (periodStart && periodEnd && unitAmount && anchorSeconds > periodStart) {
    const usedCents = Math.round((unitAmount * (anchorSeconds - periodStart)) / (periodEnd - periodStart));
    if (usedCents > 0) {
      await stripe.invoiceItems.create({
        customer: sub.customer,
        subscription: subscriptionId,
        currency: sub.currency ?? "usd",
        amount: usedCents,
        description: "Days used before your billing date moved to the 10th",
      }, { idempotencyKey: `membership-tenth-adjustment-${subscriptionId}` });
    }
  }

  const newEnd = updated.items?.data?.[0]?.current_period_end ?? anchorSeconds;
  return { shifted: true, anchor_at: new Date(newEnd * 1000).toISOString() };
}
