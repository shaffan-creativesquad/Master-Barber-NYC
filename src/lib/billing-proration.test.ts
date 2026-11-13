import { describe, expect, it } from "vitest";
import { billingDayForNewMembership, billingDayLabel, joinChargeQuote, toBillingDay, newYorkDateString } from "./billing-proration";
const monthly = { amountCents: 4999, billingInterval: "month" };
const annual = { amountCents: 129600, billingInterval: "year" };
describe("signup-day membership billing", () => {
  it("Oct 25 pays full monthly price plus 8.875% tax, next Nov 25", () => {
    const q = joinChargeQuote(new Date("2026-10-25T15:00:00Z"), 10, monthly);
    expect(q.amountCents).toBe(4999);
    expect(q.totalCents).toBe(5443);
    expect(q.prorated).toBe(false);
    expect(q.billingDay).toBe(25);
    expect(q.startDate.toISOString()).toBe("2026-11-25T12:00:00.000Z");
  });
  it("Jan 31 renews Feb 28 in a short month", () => {
    const q = joinChargeQuote(new Date("2027-01-31T15:00:00Z"), 31, monthly);
    expect(q.startDate.toISOString()).toBe("2027-02-28T12:00:00.000Z");
    expect(q.billingDay).toBe(31);
    expect(q.amountCents).toBe(4999);
  });
  it("Jan 31 renews Feb 29 in a leap year", () => {
    expect(joinChargeQuote(new Date("2028-01-31T15:00:00Z"), 31, monthly).startDate.toISOString()).toBe("2028-02-29T12:00:00.000Z");
  });
  it("annual pays full year plus tax and renews on signup anniversary", () => {
    const q = joinChargeQuote(new Date("2026-10-25T15:00:00Z"), 25, annual);
    expect(q.totalCents).toBe(141102);
    expect(q.startDate.toISOString()).toBe("2027-10-25T12:00:00.000Z");
    expect(q.prorated).toBe(false);
  });
  it("signup uses New York date even when UTC is the next day", () => {
    const now = new Date("2026-11-01T02:00:00Z");
    expect(billingDayForNewMembership(now)).toBe(31);
    expect(newYorkDateString(now)).toBe("2026-10-31");
    expect(joinChargeQuote(now, 10, monthly).startDate.toISOString()).toBe("2026-11-30T12:00:00.000Z");
  });
  it("preserves existing day 10 and supports all valid stored days", () => {
    expect(toBillingDay(10)).toBe(10);
    expect(toBillingDay(31)).toBe(31);
    expect(toBillingDay(0)).toBe(10);
    expect(toBillingDay(32)).toBe(10);
  });
  it.each([[1,"1st"],[2,"2nd"],[3,"3rd"],[4,"4th"],[11,"11th"],[12,"12th"],[13,"13th"],[21,"21st"],[22,"22nd"],[23,"23rd"],[31,"31st"]])("labels day %s", (day, label) => {
    expect(billingDayLabel(Number(day))).toBe(label);
  });
});
