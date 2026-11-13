/** Square permits at most 45 characters. Hash the full intent, never truncate IDs. */
export async function membershipRefundKey(membershipId: string, paymentId: string, amountCents: number) {
  const bytes = new TextEncoder().encode(`refund-${membershipId}-${paymentId}-${amountCents}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `refund-${Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 38)}`;
}

export function validateRefundAmount(amountCents: number, paidCents: number, refundedCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("Enter a refund amount greater than zero in whole cents.");
  if (!Number.isSafeInteger(paidCents) || !Number.isSafeInteger(refundedCents) || refundedCents < 0 || amountCents > paidCents - refundedCents) {
    throw new Error("Refund amount exceeds the remaining refundable payment.");
  }
}

export function refundEndsAccess(status: string) { return status === "PENDING" || status === "COMPLETED"; }

/**
 * Standalone refunds (membership kept) use a distinct key prefix so they can
 * never collide with the cancel flow's keys. `refundedSoFar` is part of the
 * intent: a second legitimate partial refund on the same payment gets a new
 * key, while a double-click on the same request does not double-refund.
 * Square permits at most 45 characters, so hash the full intent.
 */
export async function standaloneRefundKey(paymentId: string, amountCents: number, refundedSoFar: number) {
  const bytes = new TextEncoder().encode(`refund-only-${paymentId}-${amountCents}-${refundedSoFar}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `refund-only-${Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32)}`;
}

/** Tag payments that look like accidental duplicates: same amount within 48 hours of each other. */
export function tagDuplicatePayments<T extends { payment_id: string; amount_cents: number; date: string }>(
  payments: T[],
): (T & { possible_duplicate: boolean })[] {
  return payments.map((p) => {
    const t = Date.parse(p.date);
    const dup = payments.some((o) =>
      o.payment_id !== p.payment_id && o.amount_cents === p.amount_cents && Math.abs(Date.parse(o.date) - t) <= 48 * 3600e3);
    return { ...p, possible_duplicate: dup };
  });
}