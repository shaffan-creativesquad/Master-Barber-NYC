/** Client-safe helpers shared by the member CSV import (parsing, normalization, plan mapping). */

export type CsvRow = Record<string, string>;

/** Minimal RFC4180-ish CSV parser (handles quotes, embedded commas/newlines, BOM). */
export function parseCsv(text: string): CsvRow[] {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const header = (rows.shift() ?? []).map((h) => h.trim());
  return rows
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const o: CsvRow = {};
      header.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
      return o;
    });
}

export const MEMBERS_REQUIRED_COLUMNS = [
  "full_name",
  "login_email",
  "has_active_subscription",
  "current_subscription_plan",
  "subscription_start_date",
];

export const CONTACTS_REQUIRED_COLUMNS = ["First Name", "Last Name", "Email 1", "Phone 1"];

export function missingColumns(rows: CsvRow[], required: string[]) {
  const have = new Set(Object.keys(rows[0] ?? {}));
  return required.filter((c) => !have.has(c));
}

export function normEmail(v: string | undefined | null) {
  return (v ?? "").trim().toLowerCase();
}

/** Strip formatting and return E.164 (+1XXXXXXXXXX) when the number looks like a US number. */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/^'+/, "").replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+1${digits.slice(1)}`;
  return null;
}

/** email -> phone lookup built from a Wix contacts export. */
export function buildPhoneLookup(contacts: CsvRow[]) {
  const map = new Map<string, string>();
  for (const c of contacts) {
    const email = normEmail(c["Email 1"]) || normEmail(c["Email 2"]);
    if (!email) continue;
    const phone = normalizePhone(c["Phone 1"]) ?? normalizePhone(c["Phone 2"]);
    if (!phone) { if (!map.has(email)) continue; else continue; }
    // Prefer the row that actually carries a phone; first non-empty wins.
    if (!map.has(email)) map.set(email, phone);
  }
  return map;
}

export type PlanMapping = { plan_id: string; tier: "Bronze" | "Silver" | "Gold" };

const PLAN_MAP: Record<string, PlanMapping> = {
  "BRONZE-UNLIMITED HAIRCUT MONTHLY": { plan_id: "bronze-annual", tier: "Bronze" },
  "BRONZE-UNLIMITED HAIRCUT": { plan_id: "bronze-annual", tier: "Bronze" },
  "BRONZE-UNLIMITED BUZ HAIRCUT": { plan_id: "bronze-annual", tier: "Bronze" },
  "SILVER-UNLIMITED HAIRCUT AND BEARD TRIM": { plan_id: "silver-monthly", tier: "Silver" },
  "GOLD-UNLIMITED HAIRCUT & HOT TOWEL SHAVE": { plan_id: "gold-monthly", tier: "Gold" },
};

export function mapPlan(raw: string | undefined | null): PlanMapping | null {
  const key = (raw ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return PLAN_MAP[key] ?? null;
}

export function splitName(full: string) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "", needsNameReview: true };
  if (parts.length === 1) return { first_name: parts[0], last_name: "", needsNameReview: true };
  return { first_name: parts[0], last_name: parts.slice(1).join(" "), needsNameReview: false };
}

export function isTrue(v: string | undefined | null) {
  return (v ?? "").trim().toLowerCase() === "true";
}

/** Roll a start date forward in 30-day steps to the next occurrence after today. */
/** Accounts known to carry more than one subscription in the Wix export. */
export const MULTI_SUBSCRIPTION_NAMES = [
  "quincy christopher johnson",
  "joshua zeke thomas",
  "tom hurley",
];
