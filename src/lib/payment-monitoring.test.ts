import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the real handlers with in-memory persistence and mocked payment providers.
// No auth sessions, database writes, or Square requests leave this test.
const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, any>[]>,
  cancel: vi.fn(), charge: vi.fn(), refund: vi.fn(), payment: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown) => value;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof validate) => { validate = fn; return builder; },
      handler: (fn: (args: any) => unknown) => (args: any) => fn({ ...args, data: validate(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const filters: ((row: Record<string, any>) => boolean)[] = [];
      let operation = "select";
      let values: Record<string, any> = {};
      const execute = (single = false) => {
        const rows = mocks.tables[table] ?? [];
        if (operation === "insert") {
          const row = { id: `row-${rows.length}`, kind: "cancel", ...values };
          rows.push(row);
          return { data: single ? row : [row], error: null };
        }
        const matched = rows.filter((row) => filters.every((filter) => filter(row)));
        if (operation === "update") matched.forEach((row) => Object.assign(row, values));
        if (single && matched.length > 1) return { data: null, error: { message: "Multiple rows" } };
        return { data: single ? matched[0] ?? null : matched, error: null };
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
        in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query; },
        update: (patch: Record<string, any>) => { operation = "update"; values = patch; return query; },
        insert: (patch: Record<string, any>) => { operation = "insert"; values = patch; return query; },
        maybeSingle: async () => execute(true),
        single: async () => execute(true),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
      };
      return query;
    },
  },
}));
vi.mock("@/lib/square.server", () => ({ cancelSquareSubscriptionConfirmed: mocks.cancel, chargeSquare: mocks.charge }));
vi.mock("@/lib/membership-refund.server", () => ({ findMembershipPayment: mocks.payment, submitMembershipRefund: mocks.refund }));

import { cancelMembership } from "./members.functions";
import { cancelWithFee } from "./admin.functions";

const membershipId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";
const periodEnd = "2026-11-27T15:00:00Z";
const context = { userId: "admin" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.tables = {
    user_roles: [{ id: "role", user_id: "admin", role: "admin" }],
    memberships: [{ id: membershipId, customer_id: "customer", square_customer_id: "square-customer", square_subscription_id: "subscription", status: "active", current_period_end: periodEnd }],
    customers: [{ id: "customer", square_customer_id: "square-customer" }],
    membership_refunds: [], checkins: [],
    appointments: [{ id: appointmentId, square_card_id: "card", square_customer_id: "square-customer" }],
    business_settings: [{ cancellation_fee_cents: 2500, no_show_fee_cents: 5000 }],
  };
  mocks.cancel.mockResolvedValue(undefined);
  mocks.refund.mockResolvedValue({ id: "cancel-refund", status: "PENDING" });
  mocks.payment.mockResolvedValue({ payment_id: "latest-payment", amount_cents: 10000, refunded_cents: 0 });
  mocks.charge.mockResolvedValue({ id: "fee-payment", status: "COMPLETED" });
});

const cancelMember = (refund?: { payment_id: string; amount_cents: number }) =>
  cancelMembership({ data: { membership_id: membershipId, reason: "Admin request", refund }, context } as never);

function standaloneRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `standalone-${index}`, membership_id: membershipId, kind: "standalone", status: "REQUESTED",
    square_payment_id: `duplicate-${index}`, square_refund_id: `standalone-refund-${index}`, amount_cents: 500,
  }));
}

describe("cancellation is isolated from standalone refunds", () => {
  it("cancels without refund after two standalone refunds and preserves paid access and refund history", async () => {
    const rows = standaloneRows(2);
    mocks.tables.membership_refunds = structuredClone(rows);
    expect(await cancelMember()).toMatchObject({ ok: true, current_period_end: periodEnd });
    expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith("subscription");
    expect(mocks.tables.memberships[0]).toMatchObject({ status: "canceled", current_period_end: periodEnd });
    expect(mocks.tables.membership_refunds).toEqual(rows);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it.each([1, 2])("permits a cancellation refund after %i standalone refunds, updating only the cancel row", async (count) => {
    const rows = standaloneRows(count);
    mocks.tables.membership_refunds = structuredClone(rows);
    expect(await cancelMember({ payment_id: "latest-payment", amount_cents: 2000 })).toMatchObject({ ok: true });
    expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith("subscription");
    expect(mocks.refund).toHaveBeenCalledOnce();
    expect(mocks.tables.membership_refunds.filter((row) => row.kind === "standalone")).toEqual(rows);
    expect(mocks.tables.membership_refunds.find((row) => row.kind === "cancel")).toMatchObject({ status: "PENDING", square_refund_id: "cancel-refund", amount_cents: 2000 });
  });

  it("marks only the cancellation refund failed when Square rejects the request", async () => {
    const rows = standaloneRows(2);
    mocks.tables.membership_refunds = structuredClone(rows);
    mocks.refund.mockRejectedValue(new Error("Provider rejected refund"));
    expect(await cancelMember({ payment_id: "latest-payment", amount_cents: 2000 })).toMatchObject({ ok: false, current_period_end: periodEnd });
    expect(mocks.tables.memberships[0]).toMatchObject({ status: "canceled", current_period_end: periodEnd });
    expect(mocks.tables.membership_refunds.filter((row) => row.kind === "standalone")).toEqual(rows);
    expect(mocks.tables.membership_refunds.find((row) => row.kind === "cancel")?.status).toBe("FAILED");
  });

  it("still prevents another refund intent for the same cancellation", async () => {
    mocks.tables.membership_refunds = [{ membership_id: membershipId, kind: "cancel", status: "PENDING", square_payment_id: "latest-payment", amount_cents: 2000 }];
    await expect(cancelMember({ payment_id: "latest-payment", amount_cents: 3000 })).rejects.toThrow("A refund has already been requested for this cancellation.");
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });
});

describe("appointment fee totals include the existing 8.875% tax", () => {
  it.each([
    { kind: "cancel" as const, fee: 2500, total: 2722, column: "cancellation_fee_charged_cents" },
    { kind: "no_show" as const, fee: 5000, total: 5444, column: "no_show_fee_charged_cents" },
  ])("charges, stores, and returns the same tax-inclusive $kind total", async ({ kind, fee, total, column }) => {
    const result = await cancelWithFee({ data: { id: appointmentId, kind }, context } as never);
    expect(mocks.charge).toHaveBeenCalledWith(expect.objectContaining({ amountCents: total }));
    expect(result).toMatchObject({ charged_cents: total, fee_cents: fee, charge_error: null });
    expect(mocks.tables.appointments[0][column]).toBe(total);
  });

  it("does not record a fee as charged when the provider fails", async () => {
    mocks.charge.mockRejectedValue(new Error("Declined"));
    const result = await cancelWithFee({ data: { id: appointmentId, kind: "no_show" }, context } as never);
    expect(result).toMatchObject({ charged_cents: 0, fee_cents: 5000, charge_error: "Declined" });
    expect(mocks.tables.appointments[0].no_show_fee_charged_cents).toBe(0);
  });
});