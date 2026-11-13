import { withSalesTax } from "@/lib/site-data";
import { escapeLike } from "@/lib/escape-like";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RefundPayment } from "@/lib/membership-refund.server";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateMemberCode() {
  let out = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function digitsOnly(v: string) {
  return v.replace(/\D+/g, "");
}

function normalizeCode(v: string) {
  return v.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Single source of truth for "is this membership currently valid".
 * Imported members have no known period end yet (`current_period_end` is null
 * and `needs_review` is true), so an active status alone grants access until an
 * admin types the real expiration date in.
 */
export function isMembershipValid(
  m: { status: string; current_period_end: string | null; needs_review?: boolean | null } | null | undefined,
): boolean {
  if (!m) return false;
  // A canceled membership keeps access until the end of the period already paid for.
  if (m.status === "canceled") {
    return !!m.current_period_end && new Date(m.current_period_end).getTime() > Date.now();
  }
  if (m.status !== "active") return false;
  if (m.needs_review) return true;
  return !!m.current_period_end && new Date(m.current_period_end).getTime() > Date.now();
}

/** Cancel a legacy Stripe subscription and confirm Stripe ended it. Throws when it cannot. */
async function cancelStripeSubscriptionConfirmed(subId: string): Promise<void> {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    throw new Error(
      `This member still has an old card subscription (${subId}) and Stripe is not configured. Cancel it in the Stripe dashboard, then try again.`,
    );
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(key);
  let sub;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch (e) {
    throw new Error(`Could not check the old Stripe subscription ${subId}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (sub.status === "canceled" || sub.status === "incomplete_expired") return;
  try {
    await stripe.subscriptions.cancel(subId);
  } catch (e) {
    throw new Error(`Could not cancel the old Stripe subscription ${subId}. Nothing was changed. ${e instanceof Error ? e.message : String(e)}`);
  }
  const after = await stripe.subscriptions.retrieve(subId).catch(() => null);
  if (!after || after.status !== "canceled") {
    throw new Error(`Stripe did not confirm cancellation of ${subId}. Nothing was changed — check the Stripe dashboard.`);
  }
}

/**
 * Cancels every live card subscription on a membership row and confirms each
 * cancellation before returning. Throws (with nothing changed) if any cannot
 * be confirmed, so callers abort rather than leave billing running.
 */
async function cancelMembershipSubscriptions(
  m: { square_subscription_id?: string | null; stripe_subscription_id?: string | null },
): Promise<string[]> {
  const notes: string[] = [];
  if (m.square_subscription_id) {
    const { cancelSquareSubscriptionConfirmed } = await import("@/lib/square.server");
    await cancelSquareSubscriptionConfirmed(m.square_subscription_id);
    notes.push(`Square subscription ${m.square_subscription_id} cancelled`);
  }
  if (m.stripe_subscription_id) {
    await cancelStripeSubscriptionConfirmed(m.stripe_subscription_id);
    notes.push(`Stripe subscription ${m.stripe_subscription_id} cancelled`);
  }
  return notes;
}

import { billingDayForNewMembership, billingDayLabel, newYorkDateString, toBillingDay, type BillingDay } from "@/lib/billing-proration";

/**
 * Read-only preview of a plan's full first charge and signup-day renewal date.
 * Uses the same signup-day math as Square checkout, so staff
 * can quote exact amounts before choosing a payment method.
 */
export const previewPlanBilling = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ plan_id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();
    const plan = MEMBERSHIPS.find((m) => m.id === data.plan_id);
    if (!plan) throw new Error("Unknown membership plan.");
    const { joinChargeQuote } = await import("@/lib/billing-proration");
    const quote = joinChargeQuote(new Date(), billingDayForNewMembership(), plan);

    return {
      billing_day: quote.billingDay,
      first_charge_cents: quote.amountCents,
      first_charge_total_cents: quote.totalCents,
      prorated: quote.prorated,
      next_billing_at: quote.startDate.toISOString(),
      interval: plan.billingInterval,
    };
  });

/**
 * Cash / manual members have no card on file, so on their billing date the
 * payment simply becomes due and stays pending until an admin marks it paid.
 */
export function cashPaymentDue(
  m: { status: string; current_period_end: string | null; needs_review?: boolean | null; stripe_subscription_id?: string | null; square_subscription_id?: string | null } | null | undefined,
): boolean {
  if (!m || m.stripe_subscription_id || m.square_subscription_id) return false;
  if (m.needs_review) return false; // no trustworthy date yet
  if (m.status !== "active" && m.status !== "past_due") return false;
  return !!m.current_period_end && new Date(m.current_period_end).getTime() <= Date.now();
}


type Role = { isAdmin: boolean; isStaff: boolean };

async function requireStaff(userId: string): Promise<Role> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  const isAdmin = roles.includes("admin");
  const isStaff = roles.includes("staff");
  if (!isAdmin && !isStaff) throw new Error("Staff access required.");
  return { isAdmin, isStaff };
}

async function requireAdmin(userId: string) {
  const r = await requireStaff(userId);
  if (!r.isAdmin) throw new Error("Admin access required.");
}

/** Short-lived signed link for a member's profile photo (private bucket). */
async function signedPhotoUrl(db: any, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from("member-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Staff: attach or replace a member's profile photo (stores the storage path). */
export const setMemberPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      customer_id: z.string().uuid(),
      photo_path: z.string().trim().min(1).max(400).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("customers").update({ photo_url: data.photo_path }).eq("id", data.customer_id);
    if (error) throw new Error(error.message);
    return { ok: true as const, url: await signedPhotoUrl(supabaseAdmin, data.photo_path) };
  });

// ---------------- Check-in kiosk ----------------

/** Active barbers shown as selectable cards on the check-in popup. */
export const listCheckInBarbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("barbers")
      .select("id,name,photo_url,specialty")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { barbers: data ?? [] };
  });

const CUSTOMER_FIELDS = "id,first_name,phone,member_code,photo_url,square_customer_id,square_card_id,stripe_customer_id";

type CheckInCustomer = {
  id: string;
  first_name: string;
  phone: string;
  member_code: string | null;
  photo_url: string | null;
  square_customer_id: string | null;
  square_card_id: string | null;
  stripe_customer_id: string | null;
};

/** Does this member have a card we can charge without asking? */
async function savedCardFor(
  customer: CheckInCustomer,
): Promise<{ kind: "square"; cardId: string; customerId: string | null } | null> {
  if (customer.square_card_id) {
    return { kind: "square", cardId: customer.square_card_id, customerId: customer.square_customer_id };
  }
  return null;
}

export const checkInMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().min(1).max(64),
        confirm: z.boolean().optional(),
        barber_id: z.string().uuid().optional().nullable(),
        tip_amount_cents: z.number().int().min(0).max(1_000_00).optional(),
        tip_payment_method: z.enum(["card", "cash"]).optional().nullable(),
        tip_source_id: z.string().optional().nullable(),
        tip_verification_token: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const raw = data.code.trim();
    const digits = digitsOnly(raw);
    const isPhoneShaped = digits.length >= 7 && digits.length / Math.max(raw.length, 1) > 0.6;

    const confirmed = data.confirm === true;
    let customer: CheckInCustomer | null = null;
    let matchedVia: "member_code" | "phone" = "phone";

    // Phone first — most members identify themselves by phone number at the desk.
    if (digits.length >= 7) {
      const last7 = digits.slice(-7);
      const { data: byPhone } = await supabaseAdmin
        .from("customers").select(CUSTOMER_FIELDS).ilike("phone", `%${last7}%`).limit(2);
      if (byPhone && byPhone.length === 1) customer = byPhone[0] as CheckInCustomer;
    }

    if (!customer && !isPhoneShaped) {
      matchedVia = "member_code";
      const code = normalizeCode(raw);
      const exact = raw.trim().toUpperCase();
      const { data: byCode } = await supabaseAdmin
        .from("customers")
        .select(CUSTOMER_FIELDS)
        .or(`member_code.eq.${code},member_code.eq.${exact}`)
        .limit(2);
      if (byCode && byCode.length >= 1) customer = byCode[0] as CheckInCustomer;

      // Fallback: compare ignoring separators (e.g. "MBNYC-TEST01" vs "MBNYCTEST01")
      if (!customer) {
        const { data: all } = await supabaseAdmin
          .from("customers")
          .select(CUSTOMER_FIELDS)
          .not("member_code", "is", null)
          .limit(2000);
        const hit = (all ?? []).find((c) => normalizeCode(c.member_code ?? "") === code);
        if (hit) customer = hit as CheckInCustomer;
      }
    }


    if (!customer) {
      if (confirmed) await supabaseAdmin.from("checkins").insert({
        customer_id: null,
        matched_via: isPhoneShaped ? "phone" : "member_code",
        result: "denied",
        reason: "Not found",
        staff_user_id: context.userId,
      });
      return {
        approved: false as const,
        reason_code: "not_found" as "approved" | "expired" | "not_found" | "no_membership",
        reason: "Not found",
        staff_reason: `No customer matched "${raw}".`,
        customer_id: null as string | null,
        first_name: null as string | null,
        confirmed,
        photo_url: null as string | null,
        tier: null as string | null,
        plan_id: null as string | null,
        member_since: null as string | null,
        visits_this_month: 0,
        current_period_end: null as string | null,
        status: null as string | null,
        needs_review: false,
        has_saved_card: false,
        tip_charged_cents: 0,
        tip_error: null as string | null,
        appointment: null as { starts_at: string; barber_name: string | null } | null,
      };
    }

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("tier,status,current_period_end,plan_id,created_at,needs_review,source,stripe_subscription_id,square_subscription_id,billing_day")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const approved = isMembershipValid(membership);

    let staffReason: string | null = null;
    if (!approved) {
      if (!membership) staffReason = "No membership on file for this customer.";
      else if (membership.status !== "active") staffReason = `Membership status is ${membership.status} (last known tier: ${membership.tier}).`;
      else staffReason = `Membership expired ${membership.current_period_end ? new Date(membership.current_period_end).toLocaleDateString() : "(no period end set)"} — last known tier: ${membership.tier}.`;
    }

    // Visits this month (approved check-ins, current calendar month)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const [{ count: visitCount }, { data: appts }] = await Promise.all([
      supabaseAdmin
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .eq("result", "approved")
        .gte("created_at", monthStart),
      supabaseAdmin
        .from("appointments")
        .select("starts_at,status,barbers(name)")
        .eq("customer_id", customer.id)
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", dayEnd.toISOString())
        .order("starts_at", { ascending: true })
        .limit(1),
    ]);

    const appt = appts?.[0] as { starts_at: string; barbers?: { name: string } | null } | undefined;

    const savedCard = await savedCardFor(customer);

    // --- Tip handling (only when staff confirms the check-in) ---
    const tipAmount = Math.max(0, Math.round(data.tip_amount_cents ?? 0));
    let tipMethod: "card" | "cash" | null = null;
    let tipPaymentId: string | null = null;
    let tipCharged = 0;
    let tipError: string | null = null;

    if (confirmed && tipAmount > 0) {
      const method = data.tip_payment_method ?? (savedCard ? "card" : null);
      if (method === "cash") {
        tipMethod = "cash";
      } else if (method === "card") {
        try {
          if (data.tip_source_id) {
            const { chargeSquare } = await import("@/lib/square.server");
            const payment = await chargeSquare({
              sourceId: data.tip_source_id,
              amountCents: tipAmount,
              customerId: customer.square_customer_id,
              verificationToken: data.tip_verification_token ?? null,
              note: `Tip · check-in · ${customer.first_name}`,
            });
            if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") {
              throw new Error(`Card declined (${payment.status}).`);
            }
            tipPaymentId = payment.id;
          } else if (savedCard?.kind === "square") {
            const { chargeSquare } = await import("@/lib/square.server");
            const payment = await chargeSquare({
              sourceId: savedCard.cardId,
              amountCents: tipAmount,
              customerId: savedCard.customerId,
              note: `Tip · check-in · ${customer.first_name}`,
            });
            if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") {
              throw new Error(`Card declined (${payment.status}).`);
            }
            tipPaymentId = payment.id;
          } else {
            throw new Error("No card on file for this member.");
          }
          tipMethod = "card";
          tipCharged = tipAmount;
        } catch (e) {
          tipError = e instanceof Error ? e.message : String(e);
        }
      }
    }

    // A failed tip charge must not silently record a visit — staff retries or
    // skips the tip, and only then is the check-in written.
    if (confirmed && !tipError) {
      await supabaseAdmin.from("checkins").insert({
        customer_id: customer.id,
        matched_via: matchedVia,
        result: approved ? "approved" : "denied",
        reason: approved ? null : staffReason,
        staff_user_id: context.userId,
        barber_id: data.barber_id ?? null,
        tip_amount_cents: tipMethod ? tipAmount : 0,
        tip_payment_method: tipMethod,
        tip_payment_id: tipPaymentId,
      });
    }

    return {
      approved,
      reason_code: (approved ? "approved" : membership ? "expired" : "no_membership") as
        | "approved"
        | "expired"
        | "not_found"
        | "no_membership",
      reason: approved ? null : "Membership not active",
      staff_reason: staffReason,
      customer_id: customer.id as string | null,
      first_name: customer.first_name as string | null,
      tier: membership?.tier ?? null,
      plan_id: membership?.plan_id ?? null,
      member_since: membership?.created_at ?? null,
      visits_this_month: (visitCount ?? 0) + (approved && confirmed && !tipError ? 1 : 0),
      confirmed: confirmed && !tipError,
      photo_url: await signedPhotoUrl(supabaseAdmin, customer.photo_url),
      current_period_end: membership?.current_period_end ?? null,
      status: membership?.status ?? null,
      needs_review: membership?.needs_review ?? false,
      billing_day: membership ? toBillingDay(membership.billing_day) : billingDayForNewMembership(),
      source: membership?.source ?? null,
      stripe_subscription_id: membership?.stripe_subscription_id ?? null,
      square_subscription_id: membership?.square_subscription_id ?? null,
      auto_billing: !!membership?.stripe_subscription_id || !!membership?.square_subscription_id,
      has_saved_card: !!savedCard,
      tip_charged_cents: tipCharged,
      tip_error: tipError,
      appointment: appt ? { starts_at: appt.starts_at, barber_name: appt.barbers?.name ?? null } : null,
    };
  });

export const manualOverrideCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ customer_id: z.string().uuid(), reason: z.string().trim().min(3).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("checkins").insert({
      customer_id: data.customer_id,
      matched_via: "manual_override",
      result: "approved",
      reason: data.reason.trim(),
      staff_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------------- Admin: members ----------------

export const listMemberships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .select("id,plan_id,tier,status,current_period_end,source,needs_review,expiration_edit_count,first_expiration_edit_at,stripe_subscription_id,square_subscription_id,square_card_id,billing_invite_sent_at,tip_cents,billing_day,created_at,customer_id,customers(first_name,last_name,email,phone,member_code,photo_url)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const customerIds = [...new Set((data ?? []).map((m) => m.customer_id))];
    const { data: checkinRows } = customerIds.length
      ? await supabaseAdmin.from("checkins").select("customer_id").in("customer_id", customerIds)
      : { data: [] as { customer_id: string }[] };
    const visitsByCustomer: Record<string, number> = {};
    for (const row of checkinRows ?? []) {
      if (!row.customer_id) continue;
      visitsByCustomer[row.customer_id] = (visitsByCustomer[row.customer_id] ?? 0) + 1;
    }
    const rows = await Promise.all((data ?? []).map(async (m) => ({
      ...m,
      visit_count: visitsByCustomer[m.customer_id] ?? 0,
      photo_url: await signedPhotoUrl(supabaseAdmin, (m.customers as { photo_url?: string | null } | null)?.photo_url ?? null),
    })));
    return { rows };
  });

/**
 * Sets (or clears) a member's recurring monthly tip. The tip is charged to
 * their card on file right after each monthly membership payment on the 10th.
 * Tips are never taxed. Requires a card on file to actually charge.
 */
export const setMembershipTip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ membership_id: z.string().uuid(), tip_cents: z.number().int().min(0).max(50000) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m, error } = await supabaseAdmin
      .from("memberships")
      .update({ tip_cents: data.tip_cents })
      .eq("id", data.membership_id)
      .select("id,tip_cents,square_card_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) throw new Error("Membership not found");
    return { tip_cents: m.tip_cents, has_card: !!m.square_card_id };
  });

export const getCheckinHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rows }, { data: customer }] = await Promise.all([
      supabaseAdmin.from("checkins")
        .select("id,matched_via,result,reason,created_at,receipt_photo_path")
        .eq("customer_id", data.customer_id).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("customers")
        .select("id,first_name,last_name,email,phone,member_code").eq("id", data.customer_id).maybeSingle(),
    ]);
    return { rows: rows ?? [], customer: customer ?? null };
  });

export const searchCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("customers").select("id,first_name,last_name,email,phone,member_code").limit(20);
    if (data.q) query = query.or(`first_name.ilike.%${data.q}%,last_name.ilike.%${data.q}%,email.ilike.%${data.q}%,phone.ilike.%${data.q}%`);
    const { data: rows, error } = await query.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

type NewCustomer = { first_name: string; last_name: string; email: string; phone: string };

/**
 * Returns the customer id for these details, reusing an existing record when the
 * email is already on file (the email column is uniquely indexed) instead of
 * failing with a duplicate-key error. Missing phone / member code get filled in.
 */
async function upsertCustomerByEmail(
  db: { from: (t: string) => any },
  nc: NewCustomer,
): Promise<string> {
  const email = nc.email.trim().toLowerCase();
  const { data: existing } = await db
    .from("customers")
    .select("id,phone,member_code,first_name,last_name")
    .ilike("email", escapeLike(email))
    .maybeSingle();

  if (existing) {
    const patch: Record<string, string> = {};
    if (!existing.member_code) patch.member_code = generateMemberCode();
    if (!existing.phone && nc.phone) patch.phone = nc.phone;
    if (!existing.first_name && nc.first_name) patch.first_name = nc.first_name;
    if (!existing.last_name && nc.last_name) patch.last_name = nc.last_name;
    if (Object.keys(patch).length) await db.from("customers").update(patch).eq("id", existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await db
    .from("customers")
    .insert({ ...nc, email, member_code: generateMemberCode() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

const manualMembershipSchema = z.object({
  customer_id: z.string().uuid().optional(),
  new_customer: z
    .object({
      first_name: z.string().trim().min(1).max(80),
      last_name: z.string().trim().min(1).max(80),
      email: z.string().email(),
      phone: z.string().trim().min(7).max(30),
    })
    .optional(),
  plan_id: z.string().min(1),
  tier: z.string().min(1),
  status: z.enum(["active", "past_due", "canceled", "incomplete"]),
  current_period_end: z.string().min(4),
  payment_method: z.enum(["cash", "card"]).optional(),
  payment_ref: z.string().min(1).optional(),
  receipt_photo_path: z.string().trim().min(1).max(400).optional(),
});

export const addManualMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => manualMembershipSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.payment_method === "cash" && !data.receipt_photo_path) {
      throw new Error("A photo of the receipt is required for cash payments.");
    }

    let customerId = data.customer_id ?? null;
    if (!customerId) {
      if (!data.new_customer) throw new Error("Select an existing customer or enter new customer details.");
      customerId = await upsertCustomerByEmail(supabaseAdmin, data.new_customer);
    } else {
      const { data: existing } = await supabaseAdmin
        .from("customers").select("member_code").eq("id", customerId).maybeSingle();
      if (existing && !existing.member_code) {
        await supabaseAdmin.from("customers").update({ member_code: generateMemberCode() }).eq("id", customerId);
      }
    }

    if (data.payment_method === "card") {
      if (!data.payment_ref) throw new Error("Card payment could not be verified.");
      const { getSquarePayment } = await import("@/lib/square.server");
      const payment = await getSquarePayment(data.payment_ref);
      if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") {
        throw new Error("Card payment has not completed.");
      }
    }

    const { error: mErr } = await supabaseAdmin.from("memberships").insert({
      customer_id: customerId,
      plan_id: data.plan_id,
      tier: data.tier,
      status: data.status,
      source: "manual",
      stripe_subscription_id: null,
      current_period_end: new Date(data.current_period_end).toISOString(),
      last_payment_method: data.payment_method ?? null,
      last_renewed_at: data.payment_method ? new Date().toISOString() : null,
      billing_day: billingDayForNewMembership(),
    });
    if (mErr) throw new Error(mErr.message);

    if (data.payment_method) {
      await supabaseAdmin.from("checkins").insert({
        customer_id: customerId,
        matched_via: "renewal",
        result: "renewed",
        reason: `New ${data.tier} membership · paid by ${data.payment_method}`,
        staff_user_id: context.userId,
        receipt_photo_path: data.receipt_photo_path ?? null,
      });
    }

    return { ok: true as const, customer_id: customerId };
  });

/**
 * One-time card charge for a brand-new in-shop membership.
 * Creates the customer record (with a member code), saves the card on file in
 * Square and charges the full plan price. The membership row itself is only
 * written by addManualMembership once this charge has cleared.
 */
export const startNewMembershipCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      new_customer: z.object({
        first_name: z.string().trim().min(1).max(80),
        last_name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(160),
        phone: z.string().trim().min(7).max(30),
      }),
      plan_id: z.string().min(1),
      source_id: z.string().min(1),
      verification_token: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);

    const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();
    const plan = MEMBERSHIPS.find((m) => m.id === data.plan_id);
    if (!plan) throw new Error("Unknown membership plan.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nc = data.new_customer;
    const customerId = await upsertCustomerByEmail(supabaseAdmin, nc);

    const { ensureSquareCustomer, saveCardOnFile, chargeSquare } = await import("@/lib/square.server");
    const squareCustomerId = await ensureSquareCustomer({
      first_name: nc.first_name,
      last_name: nc.last_name,
      email: nc.email.toLowerCase(),
      phone: nc.phone,
    });
    const card = await saveCardOnFile({
      sourceId: data.source_id,
      customerId: squareCustomerId,
      cardholderName: `${nc.first_name} ${nc.last_name}`.trim(),
      verificationToken: data.verification_token ?? null,
    });
    await supabaseAdmin
      .from("customers")
      .update({ square_customer_id: squareCustomerId, square_card_id: card.id })
      .eq("id", customerId);

    const payment = await chargeSquare({
      sourceId: card.id,
      customerId: squareCustomerId,
      amountCents: withSalesTax(plan.amountCents),
      note: `${plan.name} Membership (new, in-shop) incl. 8.875% tax`,
    });
    if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") {
      throw new Error("The card was declined. Please try another card.");
    }

    return { payment_ref: payment.id, customer_id: customerId, amount_cents: withSalesTax(plan.amountCents) };
  });

export const EXPIRATION_EDIT_LIMIT = 3;
export const EXPIRATION_EDIT_WINDOW_DAYS = 3;

/** Can the admin still hand-edit this membership's expiration date in the edit modal? */
export function expirationEditsOpen(m: {
  needs_review?: boolean | null;
  expiration_edit_count?: number | null;
  first_expiration_edit_at?: string | null;
}): boolean {
  if (m.needs_review) return true;
  const count = m.expiration_edit_count ?? 0;
  if (count >= EXPIRATION_EDIT_LIMIT) return false;
  if (!m.first_expiration_edit_at) return true;
  const deadline = new Date(m.first_expiration_edit_at).getTime() + EXPIRATION_EDIT_WINDOW_DAYS * 864e5;
  return Date.now() < deadline;
}

export const updateMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["active", "past_due", "canceled", "incomplete"]),
      current_period_end: z.string().min(4).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      status: typeof data.status;
      current_period_end?: string;
      needs_review?: boolean;
      expiration_edit_count?: number;
      first_expiration_edit_at?: string;
    } = { status: data.status };

    // Marking a membership canceled must stop card billing first; never leave
    // Square or Stripe charging after the row says canceled.
    if (data.status === "canceled") {
      const { data: existing } = await supabaseAdmin
        .from("memberships")
        .select("id,status,customer_id,square_subscription_id,stripe_subscription_id")
        .eq("id", data.id)
        .maybeSingle();
      if (!existing) throw new Error("Membership not found.");
      if (existing.status !== "canceled") {
        const notes = await cancelMembershipSubscriptions(existing);
        await supabaseAdmin.from("checkins").insert({
          customer_id: existing.customer_id,
          matched_via: "manual_override",
          result: "membership_canceled",
          reason: `Status set to canceled from the Edit panel${notes.length ? ` (${notes.join("; ")})` : " (no card subscription)"}`,
          staff_user_id: context.userId,
        });
      }
    }

    if (data.current_period_end) {
      const { data: existing, error: readErr } = await supabaseAdmin
        .from("memberships")
        .select("current_period_end,needs_review,expiration_edit_count,first_expiration_edit_at")
        .eq("id", data.id)
        .maybeSingle();
      if (readErr) throw new Error(readErr.message);
      if (!existing) throw new Error("Membership not found.");

      const nextIso = new Date(data.current_period_end).toISOString();
      const changed = (existing.current_period_end ?? null) !== nextIso;
      if (changed) {
        if (!expirationEditsOpen(existing)) {
          throw new Error(
            "The expiration date is locked. It can now change only through a renewal, a Stripe sync, or an admin override with a reason.",
          );
        }
        const now = new Date().toISOString();
        patch.current_period_end = nextIso;
        patch.needs_review = false;
        patch.expiration_edit_count = (existing.expiration_edit_count ?? 0) + 1;
        patch.first_expiration_edit_at = existing.first_expiration_edit_at ?? now;
      }
    }
    const { error } = await supabaseAdmin.from("memberships").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin-only escape hatch once the grace window has closed. Reason required and logged. */
export const overrideMembershipExpiration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      current_period_end: z.string().min(4),
      reason: z.string().trim().min(5).max(300),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("memberships").select("customer_id,current_period_end").eq("id", data.id).maybeSingle();
    if (!existing) throw new Error("Membership not found.");
    const nextIso = new Date(data.current_period_end).toISOString();
    const { error } = await supabaseAdmin
      .from("memberships")
      .update({ current_period_end: nextIso, needs_review: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("checkins").insert({
      customer_id: existing.customer_id,
      matched_via: "manual_override",
      result: "expiration_override",
      reason: `Expiration overridden ${existing.current_period_end ? new Date(existing.current_period_end).toLocaleDateString() : "(unset)"} → ${new Date(nextIso).toLocaleDateString()}: ${data.reason}`,
      staff_user_id: context.userId,
    });
    return { ok: true as const };
  });


/** Admin-only: permanently delete a member (memberships, appointments, customer). Logged. */
export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      customer_id: z.string().uuid(),
      confirm_name: z.string().trim().min(1),
      reason: z.string().trim().min(5).max(300),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin
      .from("customers").select("id,first_name,last_name,email").eq("id", data.customer_id).maybeSingle();
    if (!c) throw new Error("Customer not found.");
    const fullName = `${c.first_name} ${c.last_name}`.trim();
    if (data.confirm_name.toLowerCase() !== fullName.toLowerCase()) {
      throw new Error(`Type the member's full name (${fullName}) to confirm deletion.`);
    }
    // Stop any live card billing before deleting; abort the deletion if a
    // cancellation cannot be confirmed so we never orphan a billing subscription.
    const { data: liveSubs } = await supabaseAdmin
      .from("memberships")
      .select("square_subscription_id,stripe_subscription_id")
      .eq("customer_id", c.id)
      .in("status", ["active", "past_due"]);
    for (const m of liveSubs ?? []) {
      await cancelMembershipSubscriptions(m);
    }
    // Log before deleting so there is an audit trail
    await supabaseAdmin.from("checkins").insert({
      customer_id: c.id,
      matched_via: "manual_override",
      result: "member_deleted",
      reason: `Member ${fullName} (${c.email}) permanently deleted: ${data.reason}`,
      staff_user_id: context.userId,
    });
    // Detach audit history so the customer row can be removed
    await supabaseAdmin.from("checkins").update({ customer_id: null }).eq("customer_id", c.id);
    const { error: apptErr } = await supabaseAdmin.from("appointments").delete().eq("customer_id", c.id);
    if (apptErr) throw new Error(apptErr.message);
    const { error: memErr } = await supabaseAdmin.from("memberships").delete().eq("customer_id", c.id);
    if (memErr) throw new Error(memErr.message);
    const { error: custErr } = await supabaseAdmin.from("customers").delete().eq("id", c.id);
    if (custErr) throw new Error(custErr.message);
    return { ok: true as const, name: fullName };
  });

/** Admin-only: permanently delete many members at once. Logged per member. */
export const bulkDeleteMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      customer_ids: z.array(z.string().uuid()).min(1).max(200),
      reason: z.string().trim().min(5).max(300),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customers } = await supabaseAdmin
      .from("customers").select("id,first_name,last_name,email").in("id", data.customer_ids);
    if (!customers || customers.length === 0) throw new Error("No matching customers found.");
    const deleted: string[] = [];
    const skipped: { name: string; error: string }[] = [];
    for (const c of customers) {
      const fullName = `${c.first_name} ${c.last_name}`.trim();
      // Stop live card billing first; if a cancellation cannot be confirmed,
      // skip this member (reported in the result) and continue with the rest.
      try {
        const { data: liveSubs } = await supabaseAdmin
          .from("memberships")
          .select("square_subscription_id,stripe_subscription_id")
          .eq("customer_id", c.id)
          .in("status", ["active", "past_due"]);
        for (const m of liveSubs ?? []) {
          await cancelMembershipSubscriptions(m);
        }
      } catch (e) {
        skipped.push({ name: fullName, error: e instanceof Error ? e.message : String(e) });
        continue;
      }
      await supabaseAdmin.from("checkins").insert({
        customer_id: c.id,
        matched_via: "manual_override",
        result: "member_deleted",
        reason: `Member ${fullName} (${c.email}) permanently deleted (bulk): ${data.reason}`,
        staff_user_id: context.userId,
      });
      await supabaseAdmin.from("checkins").update({ customer_id: null }).eq("customer_id", c.id);
      await supabaseAdmin.from("appointments").delete().eq("customer_id", c.id);
      await supabaseAdmin.from("memberships").delete().eq("customer_id", c.id);
      const { error } = await supabaseAdmin.from("customers").delete().eq("id", c.id);
      if (error) throw new Error(`Deleted ${deleted.length}, then failed on ${fullName}: ${error.message}`);
      deleted.push(fullName);
    }
    return { ok: true as const, deleted: deleted.length, skipped };
  });

/**
 * Admin-only: remove ONE duplicate membership row (customer is kept).
 * Cancels its Square subscription first if still live. Does not refund.
 */
export const removeDuplicateMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      membership_id: z.string().uuid(),
      reason: z.string().trim().min(5).max(300),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin
      .from("memberships").select("id,customer_id,square_subscription_id").eq("id", data.membership_id).maybeSingle();
    if (!m) throw new Error("Membership not found.");

    const { count } = await supabaseAdmin
      .from("memberships").select("id", { count: "exact", head: true })
      .eq("customer_id", m.customer_id).neq("id", m.id);
    if (!count || count < 1) {
      throw new Error("This is the member's only membership. It can't be removed as a duplicate.");
    }

    const subId = m.square_subscription_id;
    if (subId) {
      const { cancelSquareSubscriptionConfirmed } = await import("@/lib/square.server");
      await cancelSquareSubscriptionConfirmed(subId);
    }

    await supabaseAdmin.from("checkins").insert({
      customer_id: m.customer_id,
      matched_via: "manual_override",
      result: "membership_removed",
      reason: `Duplicate membership row ${m.id} removed${subId ? ` (Square subscription ${subId} cancelled)` : ""}: ${data.reason}`,
      staff_user_id: context.userId,
    });
    const { error } = await supabaseAdmin.from("memberships").delete().eq("id", m.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin-only payment preview and refund history. */
export const getMembershipRefundInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ membership_id: z.string().uuid(), history_only: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m, error } = await supabaseAdmin.from("memberships")
      .select("id,customer_id,square_customer_id,square_subscription_id,last_card_payment_id,first_payment_id").eq("id", data.membership_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) throw new Error("Membership not found.");
    const { data: refunds, error: historyError } = await supabaseAdmin.from("membership_refunds").select("amount_cents,status,created_at,square_refund_id,kind")
      .eq("membership_id", m.id).order("created_at", { ascending: false });
    if (historyError) throw new Error(historyError.message);
    if (data.history_only) return { payment: null, refunds: refunds ?? [] };
    const { data: c } = await supabaseAdmin.from("customers").select("square_customer_id").eq("id", m.customer_id).maybeSingle();
    const customerId = m.square_customer_id ?? c?.square_customer_id;
    const { findMembershipPayment } = await import("@/lib/membership-refund.server");
    return { payment: customerId ? await findMembershipPayment(m, customerId) : null, refunds: refunds ?? [] };
  });

/** Admin-only: recent completed card payments for a membership, with likely-duplicate tags. */
export const listMemberPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ membership_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m, error } = await supabaseAdmin.from("memberships")
      .select("id,customer_id,square_customer_id,square_subscription_id,last_card_payment_id,first_payment_id").eq("id", data.membership_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) throw new Error("Membership not found.");
    const { data: c } = await supabaseAdmin.from("customers").select("square_customer_id").eq("id", m.customer_id).maybeSingle();
    const customerId = m.square_customer_id ?? c?.square_customer_id;
    if (!customerId) return { payments: [] as (RefundPayment & { source: string; possible_duplicate: boolean })[] };
    const { listRecentCustomerPayments, membershipInvoicePaymentIds } = await import("@/lib/membership-refund.server");
    const invoiceIds = await membershipInvoicePaymentIds(m, customerId);
    const extra = [m.first_payment_id, m.last_card_payment_id, ...invoiceIds].filter((id): id is string => !!id);
    const payments = await listRecentCustomerPayments(customerId, extra);
    const { data: tipRows } = await supabaseAdmin.from("checkins").select("tip_payment_id")
      .eq("customer_id", m.customer_id).not("tip_payment_id", "is", null).limit(500);
    const tipIds = new Set((tipRows ?? []).map((t) => t.tip_payment_id));
    const invoiceSet = new Set(invoiceIds);
    const withSource = payments.map((p) => ({
      ...p,
      source: p.payment_id === m.first_payment_id ? "signup"
        : p.payment_id === m.last_card_payment_id ? "renewal"
        : tipIds.has(p.payment_id) ? "tip"
        : invoiceSet.has(p.payment_id) ? "subscription invoice"
        : "card payment",
    }));
    const { tagDuplicatePayments } = await import("@/lib/membership-refund");
    return { payments: tagDuplicatePayments(withSource) };
  });

/** Admin-only: refund one card payment WITHOUT canceling the membership or changing access dates. */
export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    membership_id: z.string().uuid(), payment_id: z.string().min(1).max(192),
    amount_cents: z.number().int().positive(), reason: z.string().trim().min(5).max(300),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m, error } = await supabaseAdmin.from("memberships")
      .select("id,customer_id,square_customer_id").eq("id", data.membership_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) throw new Error("Membership not found.");
    const { data: c } = await supabaseAdmin.from("customers").select("square_customer_id").eq("id", m.customer_id).maybeSingle();
    const customerId = m.square_customer_id ?? c?.square_customer_id;
    if (!customerId) throw new Error("No Square customer is linked to this membership.");
    const { readRefundPayment, submitMembershipRefund } = await import("@/lib/membership-refund.server");
    const { standaloneRefundKey, validateRefundAmount, refundEndsAccess } = await import("@/lib/membership-refund");
    const payment = await readRefundPayment(data.payment_id, customerId);
    if (!payment) throw new Error("That payment is not this member's completed card payment.");
    validateRefundAmount(data.amount_cents, payment.amount_cents, payment.refunded_cents);
    const key = await standaloneRefundKey(payment.payment_id, data.amount_cents, payment.refunded_cents);
    const { data: inserted, error: insertError } = await supabaseAdmin.from("membership_refunds").insert({
      membership_id: m.id, customer_id: m.customer_id, square_payment_id: payment.payment_id,
      idempotency_key: key, amount_cents: data.amount_cents, status: "REQUESTED", reason: data.reason,
      staff_user_id: context.userId, kind: "standalone",
    }).select("id").single();
    if (insertError || !inserted) throw new Error("This refund may already be in progress. Refresh this member before trying again.");
    let refundNote = "";
    let refundError: string | null = null;
    try {
      const refund = await submitMembershipRefund({ paymentId: payment.payment_id, amountCents: data.amount_cents, key, reason: data.reason });
      const accepted = refundEndsAccess(refund.status);
      refundNote = `Refund ${refund.id}, amount ${data.amount_cents} cents, status ${refund.status}`;
      const { error: saveError } = await supabaseAdmin.from("membership_refunds").update({ square_refund_id: refund.id, status: refund.status })
        .eq("id", inserted.id);
      if (saveError) throw new Error(`Refund ${refund.id} needs reconciliation: ${saveError.message}`);
      if (!accepted) throw new Error(`Square returned ${refund.status} for refund ${refund.id}`);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[refund-payment] refund_failed", { membership_id: m.id, payment_id: payment.payment_id, detail });
      refundError = `The refund failed: ${detail}. Refund it in Square Dashboard.`;
      refundNote += `; payment ${payment.payment_id}, requested ${data.amount_cents} cents; failure: ${detail}`;
      await supabaseAdmin.from("membership_refunds").update({ status: "FAILED" }).eq("id", inserted.id).eq("status", "REQUESTED");
    }
    const { error: auditError } = await supabaseAdmin.from("checkins").insert({
      customer_id: m.customer_id, matched_via: "manual_override", result: "payment_refunded",
      reason: `Payment refunded without canceling (membership kept); ${refundNote}: ${data.reason}`,
      staff_user_id: context.userId,
    });
    if (auditError) console.error("[refund-payment] audit_failed", { membership_id: m.id, error: auditError.message });
    return { ok: !refundError, error: refundError };
  });

/** Cancel first; optionally refund the last verified membership card payment. */
export const cancelMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    membership_id: z.string().uuid(), reason: z.string().trim().min(5).max(300),
    refund: z.object({ payment_id: z.string().min(1).max(192), amount_cents: z.number().int().positive() }).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m, error: readError } = await supabaseAdmin.from("memberships")
      .select("id,customer_id,status,current_period_end,square_customer_id,square_subscription_id,stripe_subscription_id,last_card_payment_id,first_payment_id")
      .eq("id", data.membership_id).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!m) throw new Error("Membership not found.");
    const { findMembershipPayment, submitMembershipRefund } = await import("@/lib/membership-refund.server");
    const { membershipRefundKey, validateRefundAmount, refundEndsAccess } = await import("@/lib/membership-refund");
    const { data: previous, error: previousError } = await supabaseAdmin.from("membership_refunds").select("*").eq("membership_id", m.id).eq("kind", "cancel").maybeSingle();
    if (previousError) throw new Error(previousError.message);
    const sameIntent = !!data.refund && previous?.square_payment_id === data.refund.payment_id && previous?.amount_cents === data.refund.amount_cents;
    if (m.status === "canceled" && (!sameIntent || !previous || !["REQUESTED", "FAILED", "REJECTED"].includes(previous.status))) {
      throw new Error("This membership is already canceled.");
    }
    let key = "";
    if (data.refund) {
      if (previous && (!sameIntent || refundEndsAccess(previous.status))) throw new Error("A refund has already been requested for this cancellation.");
      const { data: c } = await supabaseAdmin.from("customers").select("square_customer_id").eq("id", m.customer_id).maybeSingle();
      const customerId = m.square_customer_id ?? c?.square_customer_id;
      if (!customerId) throw new Error("No Square customer is linked to this membership.");
      const payment = await findMembershipPayment(m, customerId);
      if (!payment || payment.payment_id !== data.refund.payment_id) throw new Error("The payment is not this member's latest completed membership card payment.");
      validateRefundAmount(data.refund.amount_cents, payment.amount_cents, payment.refunded_cents);
      key = await membershipRefundKey(m.id, payment.payment_id, data.refund.amount_cents);
      if (!previous) {
        const { error } = await supabaseAdmin.from("membership_refunds").insert({
          membership_id: m.id, customer_id: m.customer_id, square_payment_id: payment.payment_id,
          idempotency_key: key, amount_cents: data.refund.amount_cents, status: "REQUESTED", reason: data.reason, staff_user_id: context.userId, kind: "cancel",
        });
        if (error) throw new Error("Another cancellation refund may be in progress. Refresh this member before trying again.");
      }
    }
    const notes = await cancelMembershipSubscriptions(m);
    // Persist cancellation before refunding: a refund failure must never restart billing.
    const { error } = await supabaseAdmin.from("memberships").update({ status: "canceled" }).eq("id", m.id);
    if (error) throw new Error(`Square billing stopped, but membership update failed: ${error.message}`);
    let refundNote = "No refund requested";
    let refundError: string | null = null;
    let currentPeriodEnd = m.current_period_end;
    if (data.refund) {
      let accepted = false;
      try {
        const refund = await submitMembershipRefund({ paymentId: data.refund.payment_id, amountCents: data.refund.amount_cents, key, reason: previous?.reason ?? data.reason });
        accepted = refundEndsAccess(refund.status);
        refundNote = `Refund ${refund.id}, amount ${data.refund.amount_cents} cents, status ${refund.status}`;
        if (accepted) {
          currentPeriodEnd = new Date().toISOString();
          const { error: accessError } = await supabaseAdmin.from("memberships").update({ status: "canceled", current_period_end: currentPeriodEnd, refund_access_ended_at: currentPeriodEnd }).eq("id", m.id);
          if (accessError) throw new Error(`Refund accepted, but access update failed: ${accessError.message}`);
        }
        const { error: saveError } = await supabaseAdmin.from("membership_refunds").update({ square_refund_id: refund.id, status: refund.status })
          .eq("membership_id", m.id).eq("kind", "cancel").in("status", ["REQUESTED", "FAILED", "REJECTED", "PENDING"]);
        if (saveError) throw new Error(`Refund ${refund.id} needs reconciliation: ${saveError.message}`);
        if (!accepted) throw new Error(`Square returned ${refund.status} for refund ${refund.id}`);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error("[membership-cancel] refund_failed", { membership_id: m.id, payment_id: data.refund.payment_id, detail });
        refundError = accepted ? `Membership canceled and refund accepted, but follow-up failed: ${detail}. Check Square Dashboard.`
          : `Membership canceled, but the refund failed: ${detail}. Refund it in Square Dashboard.`;
        refundNote += `; payment ${data.refund.payment_id}, requested ${data.refund.amount_cents} cents; failure: ${detail}`;
        if (!accepted) await supabaseAdmin.from("membership_refunds").update({ status: "FAILED" }).eq("membership_id", m.id).eq("kind", "cancel").eq("status", "REQUESTED");
      }
    }
    const { error: auditError } = await supabaseAdmin.from("checkins").insert({
      customer_id: m.customer_id, matched_via: "manual_override", result: "membership_canceled",
      reason: `Membership canceled by admin (${notes.join("; ") || "no card subscription"}); ${refundNote}: ${data.reason}`,
      staff_user_id: context.userId,
    });
    if (auditError) console.error("[membership-cancel] audit_failed", { membership_id: m.id, error: auditError.message });
    return { ok: !refundError, error: refundError, current_period_end: currentPeriodEnd };
  });

export const getExpiringMemberships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 864e5);
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .select("id,tier,plan_id,status,current_period_end,customer_id,customers(first_name,last_name,phone,email,member_code)")
      .gte("current_period_end", now.toISOString())
      .lte("current_period_end", in30.toISOString())
      .order("current_period_end");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const cutoff7 = new Date(now.getTime() + 7 * 864e5).getTime();
    return {
      within7: rows.filter((r) => new Date(r.current_period_end!).getTime() <= cutoff7),
      within30: rows,
    };
  });

export const ensureMemberCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin
      .from("customers").select("id,first_name,last_name,member_code").eq("id", data.customer_id).single();
    if (!c) throw new Error("Customer not found.");
    if (c.member_code) return { member_code: c.member_code, name: `${c.first_name} ${c.last_name}` };
    const code = generateMemberCode();
    await supabaseAdmin.from("customers").update({ member_code: code }).eq("id", data.customer_id);
    return { member_code: code, name: `${c.first_name} ${c.last_name}` };
  });

// ---------------- Kiosk: resubscribe an expired member ----------------

/** Puts an existing customer back on automatic card billing through Square. */
export const resubscribeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      customer_id: z.string().uuid(),
      plan_id: z.string().min(1),
      source_id: z.string().min(1),
      verification_token: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    // A resubscription starts a new paid period today; live subscriptions are guarded below.
    const day = billingDayForNewMembership();
    return startAnchoredSubscription(data.customer_id, data.plan_id, data.source_id, data.verification_token ?? null, day);
  });

/**
 * Full first period today through Square, then signup-day renewal. Shared by "resubscribe" and by new in-shop auto-billing signups.
 */
async function startAnchoredSubscription(
  customerId: string,
  planId: string,
  sourceId: string,
  verificationToken: string | null,
  billingDay: BillingDay,
) {
  const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();
  const plan = MEMBERSHIPS.find((m) => m.id === planId);
  if (!plan) throw new Error("Unknown membership plan.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id,first_name,last_name,email,phone,square_customer_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) throw new Error("Customer not found.");

  // Never start a second live Square subscription for the same customer.
  const { data: liveSubs } = await supabaseAdmin
    .from("memberships")
    .select("id")
    .eq("customer_id", customer.id)
    .not("square_subscription_id", "is", null)
    .in("status", ["active", "past_due"])
    .limit(1);
  if (liveSubs && liveSubs.length > 0) throw new Error("Auto-billing is already set up on this membership.");

  const {
    ensureSquareCustomer, saveCardOnFile, startMembershipBilling,
  } = await import("@/lib/square.server");


  const squareCustomerId = await ensureSquareCustomer({
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone,
    existingId: customer.square_customer_id,
  });

  const card = await saveCardOnFile({
    sourceId,
    customerId: squareCustomerId,
    cardholderName: `${customer.first_name} ${customer.last_name}`.trim(),
    verificationToken,
  });

  await supabaseAdmin
    .from("customers")
    .update({ square_customer_id: squareCustomerId, square_card_id: card.id })
    .eq("id", customer.id);

  // Square collects the first full period itself, without a separate payment.
  const todayKey = newYorkDateString();
  const billing = await startMembershipBilling({
    customerId: squareCustomerId,
    cardId: card.id,
    plan,
    billingDay,
    subscriptionIdempotencyKey: `sub-${customer.id}-${plan.id}-${todayKey}`,
  });
  const sub = billing.subscription;
  const startDate = billing.nextBillingAt;
  const firstCharge = { amountCents: billing.firstChargeCents, prorated: billing.prorated };

  const nextBilling = startDate.toISOString();
  const patch = {
    square_subscription_id: sub.id,
    square_customer_id: squareCustomerId,
    square_card_id: card.id,
    plan_id: plan.id,
    tier: plan.tier,
    status: "active" as const,
    source: "square",
    needs_review: false,
    last_payment_method: "card",
    last_renewed_at: new Date().toISOString(),
    current_period_end: nextBilling,
    billing_day: billing.billingDay,
    first_payment_id: billing.paymentId,
  };

  const { data: existing } = await supabaseAdmin
    .from("memberships")
    .select("id,tip_cents")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin.from("memberships").update(patch).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from("memberships").insert({ customer_id: customer.id, ...patch });
    if (error) throw new Error(error.message);
  }

  // Preserve recurring tips on reactivation, including today's first invoice.
  const { chargeMembershipTip } = await import("@/lib/membership-tip.server");
  await chargeMembershipTip(sub.id, billing.firstInvoiceId).catch((error) =>
    console.error("First membership tip charge failed", sub.id, error),
  );
  return {
    subscription_id: sub.id,
    payment_ref: billing.paymentId,

    customer_id: customer.id,
    first_name: customer.first_name,
    first_charge_cents: firstCharge.amountCents,
    prorated: firstCharge.prorated,
    recurring_cents: plan.amountCents,
    next_billing_at: nextBilling,
    billing_day: billing.billingDay,
    interval: plan.billingInterval,
  };
}

/**
 * New in-shop signup on auto-billing: creates/reuses the customer record, then
 * Square charges the full plan price + tax today, then renews on the signup day.
 */
export const startNewMemberAutoBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      new_customer: z.object({
        first_name: z.string().trim().min(1).max(80),
        last_name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(160),
        phone: z.string().trim().min(7).max(30),
      }),
      plan_id: z.string().min(1),
      source_id: z.string().min(1),
      verification_token: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const customerId = await upsertCustomerByEmail(supabaseAdmin, data.new_customer);
    const day = billingDayForNewMembership();
    return startAnchoredSubscription(customerId, data.plan_id, data.source_id, data.verification_token ?? null, day);
  });


/** Re-reads a customer's membership panel data (no check-in row inserted). */
export const getMemberPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: customer } = await supabaseAdmin
      .from("customers").select("id,first_name,photo_url").eq("id", data.customer_id).maybeSingle();
    if (!customer) throw new Error("Customer not found.");

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("tier,status,current_period_end,plan_id,created_at,needs_review,stripe_subscription_id,square_subscription_id,billing_day")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const approved = isMembershipValid(membership);

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const [{ count: visitCount }, { data: appts }] = await Promise.all([
      supabaseAdmin.from("checkins").select("id", { count: "exact", head: true })
        .eq("customer_id", customer.id).eq("result", "approved").gte("created_at", monthStart),
      supabaseAdmin.from("appointments").select("starts_at,status,barbers(name)")
        .eq("customer_id", customer.id)
        .gte("starts_at", dayStart.toISOString()).lt("starts_at", dayEnd.toISOString())
        .order("starts_at", { ascending: true }).limit(1),
    ]);
    const appt = appts?.[0] as { starts_at: string; barbers?: { name: string } | null } | undefined;

    return {
      approved,
      reason_code: (approved ? "approved" : membership ? "expired" : "no_membership") as
        | "approved" | "expired" | "not_found" | "no_membership",
      reason: approved ? null : "Membership not active",
      staff_reason: null as string | null,
      customer_id: customer.id as string | null,
      first_name: customer.first_name as string | null,
      confirmed: true,
      photo_url: await signedPhotoUrl(supabaseAdmin, customer.photo_url),
      tier: membership?.tier ?? null,
      plan_id: membership?.plan_id ?? null,
      member_since: membership?.created_at ?? null,
      visits_this_month: visitCount ?? 0,
      current_period_end: membership?.current_period_end ?? null,
      status: membership?.status ?? null,
      needs_review: membership?.needs_review ?? false,
      billing_day: membership ? toBillingDay(membership.billing_day) : billingDayForNewMembership(),
      auto_billing: !!membership?.stripe_subscription_id || !!membership?.square_subscription_id,
      payment_due: cashPaymentDue(membership),
      appointment: appt ? { starts_at: appt.starts_at, barber_name: appt.barbers?.name ?? null } : null,
    };
  });

/** Staff: cash / manual members whose payment is due (billed on the 10th, settled at the desk). */
export const getCashDue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .select("id,plan_id,tier,status,current_period_end,stripe_subscription_id,square_subscription_id,customer_id,customers(first_name,last_name,email)")
      .is("stripe_subscription_id", null)
      .is("square_subscription_id", null)
      .in("status", ["active", "past_due"])
      .lte("current_period_end", new Date().toISOString())
      .order("current_period_end", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((r) => {
      const plan = MEMBERSHIPS.find((m) => m.id === r.plan_id) ?? null;
      const c = r.customers as { first_name: string; last_name: string; email: string } | null;
      return {
        id: r.id as string,
        customer_id: r.customer_id as string,
        name: c ? `${c.first_name} ${c.last_name}`.trim() : "—",
        email: c?.email ?? null,
        tier: r.tier as string,
        plan_name: plan?.name ?? (r.plan_id as string),
        amount_cents: plan?.amountCents ?? null,
        due_on: r.current_period_end as string | null,
      };
    });
    return { rows };
  });

/** Staff: records a cash payment for a member and moves them to the next 10th. */
export const markCashPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    customer_id: z.string().uuid(),
    receipt_photo_path: z.string().trim().min(1).max(400),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();

    const { data: m } = await supabaseAdmin
      .from("memberships")
      .select("id,plan_id,current_period_end,stripe_subscription_id,square_subscription_id,billing_day")
      .eq("customer_id", data.customer_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!m) throw new Error("This member has no membership record.");
    if (m.stripe_subscription_id || m.square_subscription_id) throw new Error("This member is on automatic card billing — no cash payment is needed.");

    const plan = MEMBERSHIPS.find((p) => p.id === m.plan_id) ?? null;
    const interval = plan?.billingInterval ?? "month";
    const base = m.current_period_end ? new Date(m.current_period_end) : new Date();
    const newEnd = alignedRenewalEnd(base.getTime() > Date.now() ? base : new Date(), interval, toBillingDay(m.billing_day)).toISOString();

    const { error } = await supabaseAdmin
      .from("memberships")
      .update({
        status: "active" as const,
        current_period_end: newEnd,
        needs_review: false,
        last_payment_method: "cash",
        last_renewed_at: new Date().toISOString(),
      })
      .eq("id", m.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("checkins").insert({
      customer_id: data.customer_id,
      matched_via: "renewal",
      result: "renewed",
      reason: `Cash payment received${plan ? ` · ${plan.name}` : ""} · next payment ${newEnd.slice(0, 10)}`,
      staff_user_id: context.userId,
      receipt_photo_path: data.receipt_photo_path,
    });

    return { ok: true as const, current_period_end: newEnd };
  });


/** Staff: upcoming automatic membership charges. Stripe subscriptions renew on the 10th. */
export const getUpcomingBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .select("id,plan_id,tier,status,current_period_end,customer_id,customers(first_name,last_name,email)")
      .or("stripe_subscription_id.not.is.null,square_subscription_id.not.is.null")
      .in("status", ["active", "past_due"])
      .order("current_period_end", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((r) => {
      const plan = MEMBERSHIPS.find((m) => m.id === r.plan_id) ?? null;
      const c = r.customers as { first_name: string; last_name: string; email: string } | null;
      return {
        id: r.id as string,
        customer_id: r.customer_id as string,
        name: c ? `${c.first_name} ${c.last_name}`.trim() : "—",
        email: c?.email ?? null,
        tier: r.tier as string,
        plan_name: plan?.name ?? (r.plan_id as string),
        amount_cents: plan?.amountCents ?? null,
        interval: (plan?.billingInterval ?? null) as "month" | "year" | null,
        status: r.status as string,
        next_billing_at: r.current_period_end as string | null,
      };
    });
    return { rows };
  });


// ---------------- Kiosk: one-time renewal (cash or card) ----------------

/**
 * Renewal date for a manual/cash membership: the next occurrence of the 10th
 * that is at least one full billing cycle past `base`, so the member always
 * gets the full cycle they paid for and only gradually aligns to the 10th.
 */
export function alignedRenewalEnd(base: Date, interval: "month" | "year", billingDay: BillingDay = 10) {
  const min = addInterval(base, interval);
  const d = new Date(min);
  d.setHours(12, 0, 0, 0);
  if (d.getDate() > billingDay) {
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
  }
  d.setDate(billingDay);
  return d;
}

function addInterval(from: Date, interval: "month" | "year") {
  const d = new Date(from);
  if (interval === "year") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** One-time card payment for an in-shop renewal. No subscription is created. */
export const startCardRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      customer_id: z.string().uuid(),
      plan_id: z.string().min(1),
      source_id: z.string().min(1),
      verification_token: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);

    const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();
    const plan = MEMBERSHIPS.find((m) => m.id === data.plan_id);
    if (!plan) throw new Error("Unknown membership plan.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id,first_name,last_name,email,phone,square_customer_id")
      .eq("id", data.customer_id)
      .maybeSingle();
    if (!customer) throw new Error("Customer not found.");

    const { ensureSquareCustomer, saveCardOnFile, chargeSquare } = await import("@/lib/square.server");
    const squareCustomerId = await ensureSquareCustomer({
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      existingId: customer.square_customer_id,
    });
    const card = await saveCardOnFile({
      sourceId: data.source_id,
      customerId: squareCustomerId,
      cardholderName: `${customer.first_name} ${customer.last_name}`.trim(),
      verificationToken: data.verification_token ?? null,
    });
    await supabaseAdmin
      .from("customers")
      .update({ square_customer_id: squareCustomerId, square_card_id: card.id })
      .eq("id", customer.id);

    const payment = await chargeSquare({
      sourceId: card.id,
      customerId: squareCustomerId,
      amountCents: withSalesTax(plan.amountCents),
      note: `${plan.name} Membership renewal (in-shop) incl. 8.875% tax`,
    });
    if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") {
      throw new Error("The card was declined. Please try another card.");
    }

    const { data: membership } = await supabaseAdmin.from("memberships").select("id").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (membership) {
      const { error } = await supabaseAdmin.from("memberships").update({ last_card_payment_id: payment.id }).eq("id", membership.id);
      if (error) throw new Error(`Payment completed (${payment.id}), but saving its reference failed. Contact an admin before retrying.`);
    }
    return { payment_ref: payment.id, amount_cents: withSalesTax(plan.amountCents) };
  });

/** Records a one-time renewal (cash at the desk, or a card payment already captured). */
export const renewMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      customer_id: z.string().uuid(),
      plan_id: z.string().min(1),
      payment_method: z.enum(["cash", "card"]),
      payment_ref: z.string().min(1).optional(),
      receipt_photo_path: z.string().trim().min(1).max(400).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    if (data.payment_method === "cash" && !data.receipt_photo_path) {
      throw new Error("A photo of the receipt is required for cash renewals.");
    }
    const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();
    const plan = MEMBERSHIPS.find((m) => m.id === data.plan_id);
    if (!plan) throw new Error("Unknown membership plan.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.payment_method === "card") {
      if (!data.payment_ref) throw new Error("Card payment could not be verified.");
      const { data: customer } = await supabaseAdmin.from("customers").select("square_customer_id").eq("id", data.customer_id).maybeSingle();
      if (!customer?.square_customer_id) throw new Error("Card payment customer could not be verified.");
      const { readRefundPayment } = await import("@/lib/membership-refund.server");
      const payment = await readRefundPayment(data.payment_ref, customer.square_customer_id);
      if (!payment || payment.amount_cents !== withSalesTax(plan.amountCents)) throw new Error("Completed membership card payment could not be verified for this customer.");
    }

    const { data: existing } = await supabaseAdmin
      .from("memberships")
      .select("id,current_period_end,billing_day")
      .eq("customer_id", data.customer_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const renewalDay = existing ? toBillingDay(existing.billing_day) : billingDayForNewMembership();

    const base = existing?.current_period_end && new Date(existing.current_period_end).getTime() > Date.now()
      ? new Date(existing.current_period_end)
      : new Date();
    const newEnd = alignedRenewalEnd(base, plan.billingInterval, renewalDay).toISOString();

    const patch = {
      plan_id: plan.id,
      tier: plan.tier,
      status: "active" as const,
      current_period_end: newEnd,
      needs_review: false,
      ...(data.payment_method === "card" ? { last_card_payment_id: data.payment_ref } : {}),
      last_payment_method: data.payment_method,
      last_renewed_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabaseAdmin.from("memberships").update(patch).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("memberships")
        .insert({ customer_id: data.customer_id, source: "manual", billing_day: renewalDay, ...patch });
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("checkins").insert({
      customer_id: data.customer_id,
      matched_via: "renewal",
      result: "renewed",
      reason: `Renewed ${plan.name} · paid by ${data.payment_method}`,
      staff_user_id: context.userId,
      receipt_photo_path: data.receipt_photo_path ?? null,
    });

    return { ok: true as const, current_period_end: newEnd, tier: plan.tier, plan_name: plan.name };
  });

/** Staff-only: short-lived signed URL so a stored cash receipt photo can be viewed. */
export const getReceiptPhotoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().trim().min(1).max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("cash-receipts")
      .createSignedUrl(data.path, 300);
    if (error || !signed?.signedUrl) throw new Error(error?.message ?? "Could not open the receipt photo.");
    return { url: signed.signedUrl };
  });

/** Admin-only: edit an existing customer's contact details (name, email, phone). */
export const updateCustomerDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        customer_id: z.string().uuid(),
        first_name: z.string().trim().min(1).max(80),
        last_name: z.string().trim().max(80),
        email: z.string().trim().email().max(160),
        phone: z.string().trim().max(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    let phone = "";
    const digits = data.phone.replace(/\D+/g, "");
    if (digits.length) {
      if (digits.length < 10) throw new Error("Enter a full 10-digit phone number (or leave it blank).");
      phone = digits.length === 11 && digits.startsWith("1") ? `+1${digits.slice(1)}` : `+1${digits.slice(-10)}`;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email.toLowerCase(),
        phone,
      })
      .eq("id", data.customer_id);
    if (error) throw new Error(error.message);
    return { ok: true as const, phone };
  });

/** Lets staff correct a member's phone number from the kiosk / ledger. */
export const updateCustomerPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ customer_id: z.string().uuid(), phone: z.string().trim().min(7).max(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const digits = data.phone.replace(/\D+/g, "");
    if (digits.length < 10) throw new Error("Enter a full 10-digit phone number.");
    const phone = digits.length === 11 && digits.startsWith("1") ? `+1${digits.slice(1)}` : `+1${digits.slice(-10)}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("customers").update({ phone }).eq("id", data.customer_id);
    if (error) throw new Error(error.message);
    return { ok: true as const, phone };
  });

// ---------------- Billing setup invites ----------------

const SITE_ORIGIN = "https://masterbarbernyc.com";

/**
 * Builds a one-click sign-in link to the member account page, creating the
 * auth user on the fly if the member has never signed in before.
 */
async function buildMemberSignInLink(
  supabaseAdmin: { auth: { admin: { generateLink: (a: unknown) => Promise<{ data: { properties?: { action_link?: string } | null } | null; error: { message: string } | null }>; createUser: (a: unknown) => Promise<{ error: { message: string } | null }> } } },
  email: string,
): Promise<string> {
  const options = { redirectTo: `${SITE_ORIGIN}/account` };
  let res = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email, options });
  if (res.error) {
    await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
    res = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email, options });
  }
  const link = res.data?.properties?.action_link;
  if (!link) throw new Error(res.error?.message ?? "Could not create a sign-in link.");
  return link;
}

type BillingInviteResult = {
  customerId: string;
  ok: boolean;
  email: string | null;
  error?: string;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
};

async function sendBillingInviteTo(customerId: string): Promise<BillingInviteResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();

  const { data: customer } = await supabaseAdmin
    .from("customers").select("id,first_name,email").eq("id", customerId).maybeSingle();
  if (!customer?.email) return { customerId, ok: false, email: null, error: "No email on file." };

  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("plan_id,tier,current_period_end,stripe_subscription_id,square_subscription_id,square_card_id,billing_day")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (membership?.square_subscription_id && membership.square_card_id) {
    return { customerId, ok: false, email: customer.email, error: "Auto-billing already set up." };
  }

  const plan = MEMBERSHIPS.find((m) => m.id === membership?.plan_id) ?? null;
  const due = membership?.current_period_end
    ? new Date(membership.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "";

  try {
    const signInUrl = await buildMemberSignInLink(supabaseAdmin as never, customer.email);
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("billing-setup-invite", customer.email, {
      templateData: {
        firstName: customer.first_name ?? "",
        planName: plan?.name ?? membership?.tier ?? "membership",
        amount: plan ? plan.price : "",
        dueDate: due,
        billingDay: billingDayLabel(membership ? toBillingDay(membership.billing_day) : billingDayForNewMembership()),
        signInUrl,
      },
      idempotencyKey: `billing-invite-${customerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
    if (!result.sent) return { customerId, ok: false, email: customer.email, error: "Recipient unsubscribed." };
    // Record the invite so staff can see who has already been emailed.
    await supabaseAdmin
      .from("memberships")
      .update({ billing_invite_sent_at: new Date().toISOString() })
      .eq("customer_id", customerId);
    return { customerId, ok: true, email: customer.email };
  } catch (e) {
    const emailError = e as { status?: number; retryAfterSeconds?: number | null; message?: string };
    const rateLimited = emailError.status === 429 || emailError.message?.includes("429") === true;
    return {
      customerId,
      ok: false,
      email: customer.email,
      error: rateLimited ? "Email sending is temporarily paused due to high demand." : (e instanceof Error ? e.message : String(e)),
      rateLimited,
      retryAfterSeconds: rateLimited ? (emailError.retryAfterSeconds ?? 60) : undefined,
    };
  }
}

/** Staff: emails one member a secure link to add their card. */
export const sendBillingSetupInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const res = await sendBillingInviteTo(data.customer_id);
    if (!res.ok) throw new Error(res.error ?? "Could not send the email.");
    return { ok: true as const, email: res.email };
  });

/** Staff: emails a batch of members (imported / no auto-billing) their setup link. */
export const sendBillingSetupInviteBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ customer_ids: z.array(z.string().uuid()).min(1).max(25) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    let sent = 0;
    const failures: BillingInviteResult[] = [];
    // Send sequentially so a bulk action does not create an avoidable burst.
    for (const id of data.customer_ids) {
      const res = await sendBillingInviteTo(id);
      if (res.ok) sent += 1;
      else failures.push(res);
    }
    return {
      sent,
      failed: failures.length,
      successful_ids: data.customer_ids.filter((id) => !failures.some((failure) => failure.customerId === id)),
      failed_ids: failures.map((failure) => failure.customerId),
      rate_limited: failures.some((failure) => failure.rateLimited),
      retry_after_seconds: Math.max(0, ...failures.map((failure) => failure.retryAfterSeconds ?? 0)),
      failures: failures.slice(0, 10).map(({ email, error }) => ({ email, error: error ?? "Failed" })),
    };
  });

/**
 * Admin-only: move a member to a different membership plan (upgrade or downgrade).
 *
 * Card members: the existing Square subscription is cancelled and a new one is
 * created on the new plan, starting on the next 10th — no charge today, so the
 * month they already paid for is honoured and the new price begins next cycle.
 * Cash / imported members: only the plan on file changes; the renewal date and
 * the amount collected in shop are unaffected until their next renewal.
 */
export const changeMembershipPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), plan_id: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();
    const plan = MEMBERSHIPS.find((m) => m.id === data.plan_id);
    if (!plan) throw new Error("Unknown membership plan.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin
      .from("memberships")
      .select("id,customer_id,plan_id,tier,current_period_end,square_subscription_id,square_customer_id,square_card_id,stripe_subscription_id,billing_day")
      .eq("id", data.id)
      .maybeSingle();
    if (!m) throw new Error("Membership not found.");
    if (m.plan_id === plan.id) return { ok: true as const, changed: false, next_billing_at: m.current_period_end };

    if (m.stripe_subscription_id) {
      throw new Error(
        "This member still bills through the old card system. Cancel that subscription and re-add their card on the new plan.",
      );
    }

    const patch: {
      plan_id: string;
      tier: string;
      square_subscription_id?: string;
      current_period_end?: string;
      status?: "active";
      source?: string;
      needs_review?: boolean;
    } = { plan_id: plan.id, tier: plan.tier };
    let nextBilling = m.current_period_end;
    let orphanedSubscriptionId: string | null = null;

    if (m.square_subscription_id) {
      const { data: customer } = await supabaseAdmin
        .from("customers").select("square_customer_id,square_card_id").eq("id", m.customer_id).maybeSingle();
      const squareCustomerId = m.square_customer_id ?? customer?.square_customer_id ?? null;
      const cardId = m.square_card_id ?? customer?.square_card_id ?? null;
      if (!squareCustomerId || !cardId) {
        throw new Error("No card on file for this member. Ask them to add a card before switching plans.");
      }
      const {
        cancelSquareSubscription,
        getSquareSubscription,
        ensurePlanVariation,
        createAnchoredSubscription,
        nextBillingDate,
      } = await import("@/lib/square.server");
      const billingDay = toBillingDay(m.billing_day);
      // Create the replacement subscription BEFORE cancelling the old one, so a
      // failure here never leaves the member without active billing.
      const planVariationId = await ensurePlanVariation(plan);
      const startDate = nextBillingDate(billingDay);
      const sub = await createAnchoredSubscription({
        billingDay,
        customerId: squareCustomerId,
        cardId,
        planVariationId,
        billingInterval: plan.billingInterval,
        startDate,
        idempotencyKey: `plan-${m.id}-${plan.id}-${startDate.toISOString().slice(0, 10)}`,
      });

      // The old subscription must not survive: retry once, then confirm with
      // Square. Anything still live is flagged so staff can cancel it manually
      // instead of the member being billed twice on their next billing day.
      const oldId = m.square_subscription_id;
      let cancelled = false;
      for (let attempt = 0; attempt < 2 && !cancelled; attempt++) {
        try {
          await cancelSquareSubscription(oldId);
          cancelled = true;
        } catch (err) {
          console.error("Failed to cancel previous Square subscription", oldId, err);
        }
      }
      if (!cancelled) {
        try {
          const existing = await getSquareSubscription(oldId);
          cancelled = existing.status === "CANCELED" || existing.status === "DEACTIVATED";
        } catch (err) {
          console.error("Could not verify previous Square subscription status", oldId, err);
        }
      }
      if (!cancelled) {
        orphanedSubscriptionId = oldId;
        patch.needs_review = true;
      }

      nextBilling = startDate.toISOString();
      patch.square_subscription_id = sub.id;
      patch.current_period_end = nextBilling;
      patch.status = "active";
      patch.source = "square";
    }

    const { error } = await supabaseAdmin.from("memberships").update(patch).eq("id", m.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("checkins").insert({
      customer_id: m.customer_id,
      matched_via: "manual_override",
      result: "plan_change",
      reason: `Plan changed ${m.plan_id ?? "(none)"} → ${plan.id} (${plan.name})${
        m.square_subscription_id ? `; card subscription restarted, first charge ${nextBilling?.slice(0, 10)}` : ""
      }${
        orphanedSubscriptionId
          ? `; WARNING old subscription ${orphanedSubscriptionId} could not be cancelled — cancel it in Square`
          : ""
      }`,
      staff_user_id: context.userId,
    });

    return {
      ok: true as const,
      changed: true,
      next_billing_at: nextBilling,
      plan_name: plan.name,
      warning: orphanedSubscriptionId
        ? `Their previous subscription (${orphanedSubscriptionId}) could not be cancelled in Square. Cancel it there now, or they may be billed twice on their next billing day.`
        : null,
    };
  });
