import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./square.server", () => ({ squareFetch: vi.fn(), getSquareSubscription: vi.fn() }));
import { squareFetch, getSquareSubscription } from "./square.server";
import { findMembershipPayment, readRefundPayment, submitMembershipRefund } from "./membership-refund.server";

const payment = { id: "payment", customer_id: "customer", status: "COMPLETED", source_type: "CARD", amount_money: { amount: 5443, currency: "USD" }, refunded_money: { amount: 100 }, created_at: "2026-10-10", card_details: { card: { card_brand: "VISA", last_4: "1234" } } };
beforeEach(() => vi.resetAllMocks());
describe("membership refund Square boundary (mocked only)", () => {
  it("rejects another customer's payment and incomplete/cash payments", async () => {
    for (const patch of [{ customer_id: "other" }, { status: "APPROVED" }, { source_type: "CASH" }]) {
      vi.mocked(squareFetch).mockResolvedValue({ payment: { ...payment, ...patch } });
      expect(await readRefundPayment("payment", "customer")).toBeNull();
    }
  });
  it("returns card details and existing refunded amount", async () => {
    vi.mocked(squareFetch).mockResolvedValue({ payment });
    expect(await readRefundPayment("payment", "customer")).toEqual({ payment_id: "payment", amount_cents: 5443, refunded_cents: 100, date: "2026-10-10", brand: "VISA", last4: "1234" });
  });
  it("resolves subscription invoice through order tender and picks most recent membership charge", async () => {
    vi.mocked(getSquareSubscription).mockResolvedValue({ id: "sub", customer_id: "customer", status: "ACTIVE", invoice_ids: ["invoice"] });
    vi.mocked(squareFetch).mockImplementation(async (path) => {
      if (path.includes("/invoices/")) return { invoice: { status: "PAID", order_id: "order", subscription_id: "sub" } } as never;
      if (path.includes("/orders/")) return { order: { tenders: [{ payment_id: "latest" }] } } as never;
      return { payment: { ...payment, id: path.endsWith("latest") ? "latest" : "first", created_at: path.endsWith("latest") ? "2026-10-25" : "2026-09-25" } } as never;
    });
    expect((await findMembershipPayment({ square_subscription_id: "sub", first_payment_id: "first", last_card_payment_id: null }, "customer"))?.payment_id).toBe("latest");
  });
  it("sends only one refund request with the supplied deterministic key and returns pending status", async () => {
    vi.mocked(squareFetch).mockResolvedValue({ refund: { id: "refund", status: "PENDING" } });
    expect(await submitMembershipRefund({ paymentId: "payment", amountCents: 100, key: "intent", reason: "Admin reason" })).toEqual({ id: "refund", status: "PENDING" });
    expect(squareFetch).toHaveBeenCalledExactlyOnceWith("/v2/refunds", { method: "POST", body: { payment_id: "payment", amount_money: { amount: 100, currency: "USD" }, idempotency_key: "intent", reason: "Admin reason" } });
  });
});