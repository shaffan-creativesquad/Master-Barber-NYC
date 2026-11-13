import { afterEach, describe, expect, it, vi } from "vitest";
import { startMembershipBilling } from "./square.server";

const input = {
  customerId: "customer-test", cardId: "card-test", billingDay: 10,
  plan: { id: "bronze-annual", name: "Bronze", amountCents: 4999, billingInterval: "month" as const },
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("subscription-only signup payments", () => {
  function setup(paid: boolean) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T02:00:00Z"));
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "test-token");
    vi.stubEnv("SQUARE_LOCATION_ID", "test-location");
    const calls: { path: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      const body = init.body ? JSON.parse(String(init.body)) : {};
      calls.push({ path, body });
      const sub = { id: "sub-test", status: paid ? "ACTIVE" : "PAUSED", invoice_ids: ["invoice-test"] };
      let json: unknown;
      if (path === "/v2/catalog/object") json = { catalog_object: { subscription_plan_data: { subscription_plan_variations: [{ id: "variation-test" }] } } };
      else if (path === "/v2/subscriptions" || path.startsWith("/v2/subscriptions/")) json = { subscription: sub };
      else if (path === "/v2/invoices/invoice-test") json = { invoice: { id: "invoice-test", status: "PAID" } };
      else throw new Error(`Unexpected request ${path}`);
      return new Response(JSON.stringify(json), { status: 200 });
    }));
    return calls;
  }

  it("monthly starts on NY signup day, applies tax, and never makes a separate payment", async () => {
    const calls = setup(true);
    const result = await startMembershipBilling(input);
    const create = calls.find((c) => c.path === "/v2/subscriptions");
    expect(create?.body.start_date).toBe("2026-10-25");
    expect(create?.body.monthly_billing_anchor_date).toBe(25);
    expect(create?.body.tax_percentage).toBe("8.875");
    expect(calls.some((c) => c.path === "/v2/payments")).toBe(false);
    expect(result.firstInvoiceId).toBe("invoice-test");
    expect(result.nextBillingAt.toISOString()).toBe("2026-11-25T12:00:00.000Z");
    expect(result.firstChargeCents).toBe(5443);
  });

  it("annual starts today without a monthly anchor or separate charge", async () => {
    const calls = setup(true);
    const result = await startMembershipBilling({ ...input, plan: { ...input.plan, amountCents: 129600, billingInterval: "year" } });
    const create = calls.find((c) => c.path === "/v2/subscriptions");
    expect(create?.body.start_date).toBe("2026-10-25");
    expect(create?.body).not.toHaveProperty("monthly_billing_anchor_date");
    expect(calls.some((c) => c.path === "/v2/payments")).toBe(false);
    expect(result.nextBillingAt.toISOString()).toBe("2027-10-25T12:00:00.000Z");
  });

  it("payment failure rejects signup and cancels future billing without a separate refund", async () => {
    const calls = setup(false);
    await expect(startMembershipBilling(input)).rejects.toThrow("could not start");
    expect(calls.some((c) => c.path === "/v2/subscriptions/sub-test/cancel")).toBe(true);
    expect(calls.some((c) => c.path === "/v2/payments" || c.path === "/v2/refunds")).toBe(false);
  });
});