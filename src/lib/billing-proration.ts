/**
 * Shared billing-date math. New memberships renew on their New York signup day.
 * Existing memberships retain their stored billing day.
 * Client-safe (no server-only imports) so checkout can preview the same numbers
 * the server will charge.
 */

export type BillingDay = number;

/** Midnight Nov 1, 2026 in New York — the price-change moment (not a billing-day change). */
export const BILLING_DAY_CHANGE_AT = new Date("2026-11-01T04:00:00Z");

/** @deprecated Legacy constant — use the membership's stored billing_day. */
export const BILLING_DAY = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Billing day assigned to a membership created at `now`. */
export function newYorkDateParts(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function newYorkDateString(now: Date = new Date()): string {
  const { year, month, day } = newYorkDateParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Calendar date at noon UTC, safely within the same New York date. */
function calendarDate(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay), 12));
}

export function billingDayForNewMembership(now: Date = new Date()): BillingDay {
  return newYorkDateParts(now).day;
}

/** NYC sales tax applied to membership charges (same rate as the Square subscription). */
export const MEMBERSHIP_TAX_RATE = 0.08875;
export function withMembershipTax(cents: number): number {
  return Math.round(cents * (1 + MEMBERSHIP_TAX_RATE));
}

/** Normalise any stored value to a valid billing day (defaults to the 10th). */
export function toBillingDay(v: unknown): BillingDay {
  const day = Number(v);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : 10;
}

/** Next occurrence of `day`, strictly in the future. */
export function nextBillingDate(day: BillingDay, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  if (d.getDate() >= day) {
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
  }
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

/** Next occurrence of the 10th, strictly in the future. */
export function nextTenth(from: Date = new Date()): Date {
  return nextBillingDate(10, from);
}

/** Ordinal billing day for user-facing copy. */
export function billingDayLabel(day: BillingDay): string {
  const n = toBillingDay(day);
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

/** The billing day on or before `from` — the start of the cycle `from` falls in. */
function previousBillingDate(day: BillingDay, from: Date): Date {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  if (d.getDate() < day) {
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
  }
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

/** Full signup price + tax, then the signup anniversary (clamped in short months).
 * The day argument is retained for legacy callers; new signups always use today's NY day.
 */
export function joinChargeQuote(
  from: Date = new Date(),
  _day: BillingDay = billingDayForNewMembership(from),
  plan?: { amountCents: number; billingInterval: string },
): {
  amountCents: number; totalCents: number; startDate: Date; days: number;
  prorated: boolean; billingDay: BillingDay; annual: boolean;
} {
  const { year, month, day } = newYorkDateParts(from);
  const annual = plan?.billingInterval === "year" || plan?.billingInterval === "annual";
  const startDate = annual
    ? calendarDate(year + 1, month - 1, day)
    : calendarDate(year, month, day);
  const today = calendarDate(year, month - 1, day);
  const amountCents = plan?.amountCents ?? 0;
  return {
    amountCents, totalCents: withMembershipTax(amountCents), startDate,
    days: Math.round((startDate.getTime() - today.getTime()) / DAY_MS),
    prorated: false, billingDay: day, annual,
  };
}

/** Monthly prorated join charge (minimum $1). */
export function proratedJoinCharge(
  fullAmountCents: number,
  billingInterval: string,
  from: Date = new Date(),
  day: BillingDay = 10,
): { amountCents: number; startDate: Date; days: number; prorated: boolean } {
  const startDate = nextBillingDate(day, from);
  const cycleStart = previousBillingDate(day, from);
  const today = new Date(from);
  today.setHours(12, 0, 0, 0);

  const days = Math.max(1, Math.round((startDate.getTime() - today.getTime()) / DAY_MS));
  const cycleDays =
    billingInterval === "annual" || billingInterval === "year"
      ? 365
      : Math.max(1, Math.round((startDate.getTime() - cycleStart.getTime()) / DAY_MS));

  if (days >= cycleDays) {
    return { amountCents: fullAmountCents, startDate, days, prorated: false };
  }

  const amountCents = Math.max(100, Math.round((fullAmountCents * days) / cycleDays));
  return { amountCents, startDate, days, prorated: amountCents !== fullAmountCents };
}
