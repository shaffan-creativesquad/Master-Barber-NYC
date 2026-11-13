import { squareFetch, getSquareSubscription, squareLocationId } from "./square.server";

type Payment = {
  id: string; status: string; source_type?: string; customer_id?: string;
  amount_money?: { amount?: number; currency?: string };
  refunded_money?: { amount?: number }; created_at?: string;
  card_details?: { card?: { card_brand?: string; last_4?: string } };
};
export type RefundPayment = { payment_id: string; amount_cents: number; refunded_cents: number; date: string; brand: string; last4: string };
type Membership = { square_subscription_id: string | null; last_card_payment_id: string | null; first_payment_id: string | null };

function toRefundPayment(p: Payment): RefundPayment {
  return {
    payment_id: p.id, amount_cents: p.amount_money?.amount ?? 0, refunded_cents: p.refunded_money?.amount ?? 0,
    date: p.created_at ?? "", brand: p.card_details?.card?.card_brand ?? "Card", last4: p.card_details?.card?.last_4 ?? "",
  };
}

function isRefundable(p: Payment, customerId: string) {
  return !!p && p.customer_id === customerId && p.status === "COMPLETED" && p.source_type === "CARD"
    && p.amount_money?.currency === "USD" && (p.amount_money?.amount ?? 0) > 0;
}

export async function readRefundPayment(id: string, customerId: string): Promise<RefundPayment | null> {
  const { payment: p } = await squareFetch<{ payment?: Payment }>(`/v2/payments/${encodeURIComponent(id)}`);
  if (!isRefundable(p as Payment, customerId)) return null;
  return toRefundPayment(p as Payment);
}

/** Payment ids from this membership's paid subscription invoices. */
export async function membershipInvoicePaymentIds(m: Membership, customerId: string): Promise<string[]> {
  const ids = new Set<string>();
  if (!m.square_subscription_id) return [];
  const sub = await getSquareSubscription(m.square_subscription_id);
  if (sub.customer_id !== customerId) throw new Error("Square subscription customer does not match this member.");
  for (const invoiceId of sub.invoice_ids ?? []) {
    const { invoice } = await squareFetch<{ invoice?: { status?: string; order_id?: string; subscription_id?: string } }>(`/v2/invoices/${encodeURIComponent(invoiceId)}`);
    if (!invoice?.order_id || !["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(invoice.status ?? "") || invoice.subscription_id !== sub.id) continue;
    const { order } = await squareFetch<{ order?: { tenders?: Array<{ payment_id?: string }> } }>(`/v2/orders/${encodeURIComponent(invoice.order_id)}`);
    for (const tender of order?.tenders ?? []) if (tender.payment_id) ids.add(tender.payment_id);
  }
  return [...ids];
}

/** Only known membership charges: never tips, bookings, or unrelated POS charges. */
export async function findMembershipPayment(m: Membership, customerId: string): Promise<RefundPayment | null> {
  const ids = new Set<string>();
  if (m.last_card_payment_id) ids.add(m.last_card_payment_id);
  for (const id of await membershipInvoicePaymentIds(m, customerId)) ids.add(id);
  if (m.first_payment_id) ids.add(m.first_payment_id);
  const payments: RefundPayment[] = [];
  for (const id of ids) {
    const payment = await readRefundPayment(id, customerId);
    if (payment) payments.push(payment);
  }
  return payments.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

/**
 * Recent completed card payments for this customer (last ~90 days, newest first),
 * merged with any stored membership payment ids so older signup/renewal charges
 * are still listed. Deduped by payment id.
 */
export async function listRecentCustomerPayments(customerId: string, extraIds: Iterable<string>): Promise<RefundPayment[]> {
  const byId = new Map<string, RefundPayment>();
  const begin = new Date(Date.now() - 90 * 864e5).toISOString();
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const qs = new URLSearchParams({ location_id: squareLocationId(), begin_time: begin, sort_order: "DESC", limit: "100" });
    if (cursor) qs.set("cursor", cursor);
    const res = await squareFetch<{ payments?: Payment[]; cursor?: string }>(`/v2/payments?${qs.toString()}`);
    for (const p of res.payments ?? []) {
      if (isRefundable(p, customerId)) byId.set(p.id, toRefundPayment(p));
    }
    cursor = res.cursor;
    if (!cursor) break;
  }
  for (const id of extraIds) {
    if (byId.has(id)) continue;
    const p = await readRefundPayment(id, customerId);
    if (p) byId.set(p.payment_id, p);
  }
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export async function submitMembershipRefund(input: { paymentId: string; amountCents: number; key: string; reason: string }) {
  const { refund } = await squareFetch<{ refund?: { id: string; status: string } }>("/v2/refunds", {
    method: "POST", body: {
      payment_id: input.paymentId, amount_money: { amount: input.amountCents, currency: "USD" },
      idempotency_key: input.key, reason: input.reason.slice(0, 192),
    },
  });
  if (!refund?.id) throw new Error("Square did not return a refund confirmation.");
  return refund;
}
