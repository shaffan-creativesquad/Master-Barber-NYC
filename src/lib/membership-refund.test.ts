import { describe, expect, it } from "vitest";
import { membershipRefundKey, validateRefundAmount, refundEndsAccess, standaloneRefundKey, tagDuplicatePayments } from "./membership-refund";

describe("cancellation refunds", () => {
  it("allows full remaining and partial refunds", () => {
    expect(() => validateRefundAmount(4000, 5000, 1000)).not.toThrow();
    expect(() => validateRefundAmount(500, 5000, 1000)).not.toThrow();
  });
  it("rejects amounts above the remainder", () => { expect(() => validateRefundAmount(4001, 5000, 1000)).toThrow(); });
  it("rejects zero, negative, fractional, and invalid amounts", () => {
    for (const amount of [0, -1, 1.5, NaN]) expect(() => validateRefundAmount(amount, 5000, 0)).toThrow();
  });
  it("uses the same bounded key for the same intent", async () => {
    const key = await membershipRefundKey("membership-1", "payment-1", 4000);
    expect(key).toBe(await membershipRefundKey("membership-1", "payment-1", 4000));
    expect(key.length).toBe(45);
    expect(key).not.toBe(await membershipRefundKey("membership-2", "payment-1", 4000));
    expect(key).not.toBe(await membershipRefundKey("membership-1", "payment-2", 4000));
    expect(key).not.toBe(await membershipRefundKey("membership-1", "payment-1", 3999));
  });
  it("ends access for full or partial accepted refunds, not failures", () => {
    expect(refundEndsAccess("PENDING")).toBe(true);
    expect(refundEndsAccess("COMPLETED")).toBe(true);
    expect(refundEndsAccess("FAILED")).toBe(false);
    expect(refundEndsAccess("REJECTED")).toBe(false);
  });
});

describe("standalone payment refunds", () => {
  it("is deterministic, within Square's 45-character limit, and prefixed distinctly from cancel refunds", async () => {
    const key = await standaloneRefundKey("payment-1", 5000, 0);
    expect(key).toBe(await standaloneRefundKey("payment-1", 5000, 0));
    expect(key.length).toBeLessThanOrEqual(45);
    expect(key.startsWith("refund-only-")).toBe(true);
    expect(key).not.toBe(await membershipRefundKey("membership-1", "payment-1", 5000));
  });
  it("changes when the payment, amount, or already-refunded amount changes", async () => {
    const base = await standaloneRefundKey("payment-1", 5000, 0);
    expect(base).not.toBe(await standaloneRefundKey("payment-2", 5000, 0));
    expect(base).not.toBe(await standaloneRefundKey("payment-1", 4000, 0));
    // A second legitimate partial refund on the same payment gets a new key.
    expect(base).not.toBe(await standaloneRefundKey("payment-1", 5000, 1000));
  });
});

describe("duplicate payment tagging", () => {
  const pay = (id: string, cents: number, date: string) => ({ payment_id: id, amount_cents: cents, date });
  it("tags two same-amount payments within 48 hours as possible duplicates", () => {
    const tagged = tagDuplicatePayments([
      pay("a", 4999, "2026-10-25T14:00:00Z"),
      pay("b", 4999, "2026-10-25T14:05:00Z"),
    ]);
    expect(tagged.map((p) => p.possible_duplicate)).toEqual([true, true]);
  });
  it("does not tag same-amount payments more than 48 hours apart", () => {
    const tagged = tagDuplicatePayments([
      pay("a", 4999, "2026-10-25T14:00:00Z"),
      pay("b", 4999, "2026-10-28T14:00:00Z"),
    ]);
    expect(tagged.map((p) => p.possible_duplicate)).toEqual([false, false]);
  });
  it("does not tag different amounts, and never tags a lone payment", () => {
    const tagged = tagDuplicatePayments([
      pay("a", 4999, "2026-10-25T14:00:00Z"),
      pay("b", 5999, "2026-10-25T14:05:00Z"),
      pay("c", 2500, "2026-10-20T10:00:00Z"),
    ]);
    expect(tagged.map((p) => p.possible_duplicate)).toEqual([false, false, false]);
  });
});