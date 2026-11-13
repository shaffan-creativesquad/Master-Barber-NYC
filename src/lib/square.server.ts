/**
 * Thin fetch-based Square client.
 *
 * Uses the REST API directly rather than the Node SDK so it runs unchanged in
 * the edge worker runtime. Every call reads credentials at call time.
 */

const SQUARE_VERSION = "2025-06-18";

export type SquareEnvironment = "sandbox" | "production";

export function squareEnvironment(): SquareEnvironment {
  const raw = (process.env["SQUARE_ENVIRONMENT"] ?? "sandbox").trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

export function squareApiBase(): string {
  return squareEnvironment() === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

/** URL of the Web Payments SDK that matches the current environment. */
export function squareWebSdkUrl(): string {
  return squareEnvironment() === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";
}

export function squareAccessToken(): string {
  const token = process.env["SQUARE_ACCESS_TOKEN"];
  if (!token) throw new Error("Square is not configured yet.");
  return token;
}

export function squareLocationId(): string {
  const id = process.env["SQUARE_LOCATION_ID"];
  if (!id) throw new Error("Square location is not configured yet.");
  return id;
}

export function newIdempotencyKey(prefix = "mb"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

type SquareError = { category?: string; code?: string; detail?: string; field?: string };

export async function squareFetch<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${squareApiBase()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Square-Version": SQUARE_VERSION,
      Authorization: `Bearer ${squareAccessToken()}`,
      "Content-Type": "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const errors = (json as { errors?: SquareError[] } | null)?.errors ?? [];
    const detail = errors.map((e) => e.detail ?? e.code).filter(Boolean).join(" ");
    throw new Error(detail || `Square request failed (${res.status}).`);
  }

  return (json ?? {}) as T;
}

/* ------------------------------------------------------------------ */
/* Billing date helpers — per-membership billing day (1st or 10th).    */
/* ------------------------------------------------------------------ */

export { BILLING_DAY, nextTenth, nextBillingDate, proratedJoinCharge } from "@/lib/billing-proration";
import { nextBillingDate, newYorkDateString, type BillingDay } from "@/lib/billing-proration";



/** Square wants plain calendar dates, not timestamps. */
export function toSquareDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Customers, cards, payments                                          */
/* ------------------------------------------------------------------ */

export type SquareCustomer = { id: string };

export async function findSquareCustomerByEmail(email: string): Promise<string | null> {
  const res = await squareFetch<{ customers?: Array<{ id: string }> }>("/v2/customers/search", {
    method: "POST",
    body: { limit: 1, query: { filter: { email_address: { exact: email } } } },
  });
  return res.customers?.[0]?.id ?? null;
}

export async function ensureSquareCustomer(input: {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  existingId?: string | null;
}): Promise<string> {
  if (input.existingId) return input.existingId;
  const found = await findSquareCustomerByEmail(input.email);
  if (found) return found;
  const res = await squareFetch<{ customer?: { id: string } }>("/v2/customers", {
    method: "POST",
    body: {
      idempotency_key: newIdempotencyKey("cust"),
      given_name: input.first_name,
      family_name: input.last_name,
      email_address: input.email,
      phone_number: input.phone,
    },
  });
  const id = res.customer?.id;
  if (!id) throw new Error("Could not create the payment profile.");
  return id;
}

/** Turn a one-time card token from the browser into a reusable card on file. */
export async function saveCardOnFile(input: {
  sourceId: string;
  customerId: string;
  cardholderName: string;
  verificationToken?: string | null;
}): Promise<{ id: string; last4: string | null; brand: string | null }> {
  const res = await squareFetch<{ card?: { id: string; last_4?: string; card_brand?: string } }>("/v2/cards", {
    method: "POST",
    body: {
      idempotency_key: newIdempotencyKey("card"),
      source_id: input.sourceId,
      ...(input.verificationToken ? { verification_token: input.verificationToken } : {}),
      card: { customer_id: input.customerId, cardholder_name: input.cardholderName },
    },
  });
  const card = res.card;
  if (!card?.id) throw new Error("The card could not be saved.");
  return { id: card.id, last4: card.last_4 ?? null, brand: card.card_brand ?? null };
}

/** Charge a saved card (or a fresh token) once. */
export async function chargeSquare(input: {
  sourceId: string;
  amountCents: number;
  customerId?: string | null;
  note?: string;
  idempotencyKey?: string;
  verificationToken?: string | null;
}): Promise<{ id: string; status: string }> {
  const res = await squareFetch<{ payment?: { id: string; status: string } }>("/v2/payments", {
    method: "POST",
    body: {
      idempotency_key: input.idempotencyKey ?? newIdempotencyKey("pay"),
      source_id: input.sourceId,
      ...(input.customerId ? { customer_id: input.customerId } : {}),
      ...(input.verificationToken ? { verification_token: input.verificationToken } : {}),
      location_id: squareLocationId(),
      amount_money: { amount: input.amountCents, currency: "USD" },
      autocomplete: true,
      ...(input.note ? { note: input.note.slice(0, 500) } : {}),
    },
  });
  const payment = res.payment;
  if (!payment?.id) throw new Error("The payment did not go through.");
  return { id: payment.id, status: payment.status };
}

export async function getSquarePayment(paymentId: string): Promise<{ id: string; status: string; amount: number | null }> {
  const res = await squareFetch<{ payment?: { id: string; status: string; amount_money?: { amount?: number } } }>(
    `/v2/payments/${encodeURIComponent(paymentId)}`,
  );
  const p = res.payment;
  if (!p) throw new Error("Payment not found.");
  return { id: p.id, status: p.status, amount: p.amount_money?.amount ?? null };
}

/* ------------------------------------------------------------------ */
/* Subscription plans (catalog) + subscriptions                        */
/* ------------------------------------------------------------------ */

/**
 * Create (or reuse) the catalog subscription plan variation for a membership
 * tier. The idempotency key is derived from the plan id and price, so repeat
 * calls return the same catalog objects instead of duplicating them.
 */
export async function ensurePlanVariation(plan: {
  id: string;
  name: string;
  amountCents: number;
  billingInterval: "month" | "year";
}): Promise<string> {
  const cadence = plan.billingInterval === "year" ? "ANNUAL" : "MONTHLY";
  const res = await squareFetch<{
    catalog_object?: {
      id: string;
      subscription_plan_data?: { subscription_plan_variations?: Array<{ id: string }> };
    };
  }>("/v2/catalog/object", {
    method: "POST",
    body: {
      idempotency_key: `plan-${plan.id}-${plan.amountCents}-${cadence}`,
      object: {
        type: "SUBSCRIPTION_PLAN",
        id: `#plan-${plan.id}`,
        subscription_plan_data: {
          name: `${plan.name} Membership`,
          all_items: false,
          subscription_plan_variations: [
            {
              type: "SUBSCRIPTION_PLAN_VARIATION",
              id: `#var-${plan.id}`,
              subscription_plan_variation_data: {
                name: `${plan.name} — ${cadence === "ANNUAL" ? "annual" : "monthly"}`,
                phases: [
                  {
                    cadence,
                    ordinal: 0,
                    pricing: { type: "STATIC", price_money: { amount: plan.amountCents, currency: "USD" } },
                  },
                ],
              },
            },
          ],
        },
      },
    },
  });

  const variationId = res.catalog_object?.subscription_plan_data?.subscription_plan_variations?.[0]?.id;
  if (!variationId) throw new Error("Could not set up the membership plan in Square.");
  return variationId;
}

export type SquareSubscription = {
  id: string;
  status: string;
  customer_id: string;
  card_id?: string;
  start_date?: string;
  charged_through_date?: string;
  invoice_ids?: string[];
  canceled_date?: string;
  plan_variation_id?: string;
  monthly_billing_anchor_date?: number;
  source?: { name?: string };
};

/**
 * Start a membership subscription anchored to the membership's billing day
 * using its stored billing day. New signups start immediately on their NY signup date.
 * Future starts preserve existing billing; immediateSignup starts the first invoice today.
 */
export async function createAnchoredSubscription(input: {
  customerId: string;
  cardId: string;
  planVariationId: string;
  billingDay: BillingDay;
  billingInterval?: "month" | "year";
  startDate?: Date;
  idempotencyKey?: string;
  immediateSignup?: boolean;
}): Promise<SquareSubscription> {
  const start = input.startDate ?? nextBillingDate(input.billingDay);
  const res = await squareFetch<{ subscription?: SquareSubscription }>("/v2/subscriptions", {
    method: "POST",
    body: {
      idempotency_key: input.idempotencyKey ?? newIdempotencyKey("sub"),
      location_id: squareLocationId(),
      customer_id: input.customerId,
      card_id: input.cardId,
      plan_variation_id: input.planVariationId,
      // NYC sales tax added on top of every recurring membership charge.
      tax_percentage: "8.875",
      start_date: input.immediateSignup ? newYorkDateString(start) : toSquareDate(start),
      ...(input.immediateSignup ? { source: { name: SIGNUP_BILLING_SOURCE } } : {}),
      // Only monthly plans take an anchor day; annual plans bill on their start date.
      ...(input.billingInterval === "year" ? {} : { monthly_billing_anchor_date: input.billingDay }),
    },
  });
  const sub = res.subscription;
  if (!sub?.id) throw new Error("The membership could not be started.");
  return sub;
}

export async function getSquareSubscription(id: string): Promise<SquareSubscription> {
  const res = await squareFetch<{ subscription?: SquareSubscription }>(
    `/v2/subscriptions/${encodeURIComponent(id)}`,
  );
  if (!res.subscription) throw new Error("Subscription not found.");
  return res.subscription;
}

export async function cancelSquareSubscription(id: string): Promise<void> {
  await squareFetch(`/v2/subscriptions/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

/**
 * Cancel a Square subscription and confirm Square actually ended it.
 * Treats an already-canceled/deactivated subscription as success (idempotent).
 * Throws — with nothing changed — when Square cannot be reached or does not
 * confirm the cancellation, so callers can abort instead of leaving billing live.
 */
export async function cancelSquareSubscriptionConfirmed(id: string): Promise<{ alreadyEnded: boolean }> {
  const ended = (s: string) => ["CANCELED", "DEACTIVATED"].includes(s.toUpperCase());
  let sub: SquareSubscription;
  try {
    sub = await getSquareSubscription(id);
  } catch (e) {
    throw new Error(`Could not check the Square subscription ${id}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (ended(sub.status) || sub.canceled_date) return { alreadyEnded: true };
  try {
    await cancelSquareSubscription(id);
  } catch (e) {
    throw new Error(`Could not cancel Square subscription ${id}. Nothing was changed. ${e instanceof Error ? e.message : String(e)}`);
  }
  const after = await getSquareSubscription(id).catch(() => null);
  if (!after || (!ended(after.status) && !after.canceled_date)) {
    throw new Error(`Square did not confirm cancellation of ${id}. Nothing was changed — check Square Dashboard.`);
  }
  return { alreadyEnded: false };
}

/** Schedule a plan swap; Square applies it at the start of the next billing cycle. */
export async function swapSquarePlan(id: string, newPlanVariationId: string): Promise<SquareSubscription> {
  const res = await squareFetch<{ subscription?: SquareSubscription }>(
    `/v2/subscriptions/${encodeURIComponent(id)}/swap-plan`,
    { method: "POST", body: { new_plan_variation_id: newPlanVariationId } },
  );
  if (!res.subscription) throw new Error("Plan swap returned no subscription.");
  return res.subscription;
}

/** Pending SWAP_PLAN actions on a subscription (to keep the migration idempotent). */
export async function pendingSwapTargets(id: string): Promise<string[]> {
  const res = await squareFetch<{
    subscription?: { actions?: Array<{ type?: string; new_plan_variation_id?: string }> };
  }>(`/v2/subscriptions/${encodeURIComponent(id)}?include=actions`);
  return (res.subscription?.actions ?? [])
    .filter((a) => a.type === "SWAP_PLAN" && a.new_plan_variation_id)
    .map((a) => a.new_plan_variation_id as string);
}

/* ------------------------------------------------------------------ */
/* Webhook signature                                                   */
/* ------------------------------------------------------------------ */

/**
 * Square signs `notificationUrl + rawBody` with the webhook signature key
 * (HMAC-SHA256, base64) and sends it as `x-square-hmacsha256-signature`.
 */
export async function verifySquareSignature(input: {
  notificationUrl: string;
  rawBody: string;
  signature: string;
  signatureKey: string;
}): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(input.signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(input.notificationUrl + input.rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (expected.length !== input.signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ input.signature.charCodeAt(i);
  return diff === 0;
}

/** Full refund of a one-time Square payment. */
export async function refundSquarePayment(paymentId: string, amountCents: number, reason?: string): Promise<void> {
  await squareFetch("/v2/refunds", {
    method: "POST",
    body: {
      idempotency_key: `refund-${paymentId}`,
      payment_id: paymentId,
      amount_money: { amount: amountCents, currency: "USD" },
      ...(reason ? { reason: reason.slice(0, 192) } : {}),
    },
  });
}

export const SIGNUP_BILLING_SOURCE = "Master Barber NYC signup-day";

/** Square creates and charges subscription invoices asynchronously. Never charge separately. */
export async function firstPaidSubscriptionInvoice(sub: SquareSubscription): Promise<string | null> {
  for (const id of sub.invoice_ids ?? []) {
    const result = await squareFetch<{ invoice?: { id: string; status?: string } }>(
      `/v2/invoices/${encodeURIComponent(id)}`,
    );
    if (result.invoice?.status === "PAID") return result.invoice.id;
  }
  return null;
}

/** Shared signup path: Square alone collects the full first period plus tax. */
export async function startMembershipBilling(input: {
  customerId: string;
  cardId: string;
  plan: { id: string; name: string; amountCents: number; billingInterval: "month" | "year" };
  billingDay: BillingDay;
  subscriptionIdempotencyKey?: string;
}): Promise<{
  subscription: SquareSubscription;
  paymentId: string | null;
  firstInvoiceId: string;
  firstChargeCents: number;
  prorated: boolean;
  nextBillingAt: Date;
  billingDay: BillingDay;
}> {
  const { joinChargeQuote } = await import("@/lib/billing-proration");
  const now = new Date();
  const quote = joinChargeQuote(now, input.billingDay, input.plan);
  const planVariationId = await ensurePlanVariation(input.plan);
  const created = await createAnchoredSubscription({
    customerId: input.customerId, cardId: input.cardId, planVariationId,
    billingDay: quote.billingDay, billingInterval: input.plan.billingInterval,
    startDate: now, immediateSignup: true,
    idempotencyKey: input.subscriptionIdempotencyKey,
  });
  try {
    for (let attempt = 0; attempt < 12; attempt++) {
      const subscription = await getSquareSubscription(created.id);
      if (["CANCELED", "DEACTIVATED", "PAUSED"].includes(subscription.status)) {
        throw new Error("Square could not start your membership payment.");
      }
      const invoiceId = await firstPaidSubscriptionInvoice(subscription);
      if (invoiceId) return {
        subscription, paymentId: null, firstInvoiceId: invoiceId,
        firstChargeCents: quote.totalCents, prorated: false,
        nextBillingAt: quote.startDate, billingDay: quote.billingDay,
      };
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("Square has not confirmed the first payment. Please contact the shop before trying again.");
  } catch (error) {
    // Stop future invoices if the initial payment failed or could not be confirmed.
    // No separate charge or automatic refund: a payment may still be settling.
    try {
      await cancelSquareSubscription(created.id);
    } catch (cancelError) {
      console.error("Signup payment unconfirmed; subscription cancellation failed", created.id, cancelError);
      throw new Error("Payment could not be confirmed and billing needs staff review. Please contact the shop before trying again.");
    }
    throw error;
  }
}
