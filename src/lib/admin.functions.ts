import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SALES_TAX_PERCENT, withSalesTax } from "@/lib/site-data";

// Bootstrap: promote current user to admin if there are no admins yet.
// Safe to expose because it only works on the very first call.
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("user_roles").select("id").eq("role", "admin").limit(1);
    if (existing && existing.length > 0) {
      // Only allow if the current user is already admin
      const { data: mine } = await supabaseAdmin
        .from("user_roles").select("id").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
      if (!mine) {
        return {
          ok: false as const,
          message: "An admin already exists. Ask them to grant you access.",
        };
      }
      return { ok: true as const, message: "You are already an admin." };
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    return { ok: true as const, message: "You are now an admin." };
  });

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return { isAdmin: roles.includes("admin"), isStaff: roles.includes("staff"), roles };
  });

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin access required.");
}

// ============ Dashboard data ============
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const [{ data: today }, { data: upcoming }, { count: total }, { data: pending }] = await Promise.all([
      supabaseAdmin.from("appointments")
        .select("id,starts_at,ends_at,status,price_cents,notes,barber_id,service_id,location_id,customer_id,customers(first_name,last_name,phone,email),services(name),barbers(name),locations(name)")
        .gte("starts_at", startOfDay).lt("starts_at", endOfDay).order("starts_at"),
      supabaseAdmin.from("appointments")
        .select("id,starts_at,ends_at,status,price_cents,customers(first_name,last_name),services(name),barbers(name),locations(name)")
        .gte("starts_at", endOfDay).order("starts_at").limit(15),
      supabaseAdmin.from("appointments").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("appointments")
        .select("id,starts_at,status,customers(first_name,last_name),services(name)")
        .eq("status", "pending").order("starts_at").limit(20),
    ]);

    const revenueToday = (today ?? [])
      .filter((a) => a.status === "completed" || a.status === "confirmed" || a.status === "checked_in")
      .reduce((sum, a) => sum + (a.price_cents ?? 0), 0);

    return {
      today: today ?? [],
      upcoming: upcoming ?? [],
      total: total ?? 0,
      pending: pending ?? [],
      revenue_today_cents: revenueToday,
    };
  });

// ============ Appointments list ============
const listSchema = z.object({
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  location_id: z.string().uuid().nullable().optional(),
});
export const listAppointments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("appointments")
      .select("id,starts_at,ends_at,status,price_cents,duration_min,notes,barber_id,service_id,location_id,customer_id,customers(first_name,last_name,phone,email),services(name),barbers(name),locations(name)")
      .order("starts_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status as never);
    if (data.location_id) q = q.eq("location_id", data.location_id);
    if (data.from) q = q.gte("starts_at", data.from);
    if (data.to) q = q.lte("starts_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============ Appointment mutations ============
export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["pending","confirmed","checked_in","completed","cancelled","no_show"]),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("appointments").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Charge the card saved at booking time for a cancellation or no-show fee.
async function chargeStoredCard(opts: {
  amount_cents: number;
  card_id: string;
  customer_id?: string | null;
  description: string;
}) {
  const { chargeSquare } = await import("@/lib/square.server");
  return chargeSquare({
    sourceId: opts.card_id,
    customerId: opts.customer_id ?? null,
    amountCents: opts.amount_cents, // Caller supplies the tax-inclusive total.
    note: opts.description,
  });
}

export const cancelWithFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    kind: z.enum(["cancel", "no_show"]),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt, error: aerr } = await supabaseAdmin
      .from("appointments")
      .select("id, square_card_id, square_customer_id, cancellation_fee_charged_cents, no_show_fee_charged_cents")
      .eq("id", data.id).single();
    if (aerr || !appt) throw new Error("Appointment not found");
    const { data: settings } = await supabaseAdmin.from("business_settings").select("cancellation_fee_cents,no_show_fee_cents").single();
    const fee = data.kind === "cancel" ? (settings?.cancellation_fee_cents ?? 0) : (settings?.no_show_fee_cents ?? 0);
    const totalFee = withSalesTax(fee);
    const newStatus = data.kind === "cancel" ? "cancelled" : "no_show";

    let chargedCents = 0;
    let chargeError: string | null = null;
    if (fee > 0 && appt.square_card_id) {
      try {
        const payment = await chargeStoredCard({
          amount_cents: totalFee,
          card_id: appt.square_card_id,
          customer_id: appt.square_customer_id,
          description: `${data.kind === "cancel" ? "Late cancellation" : "No-show"} fee (incl. ${SALES_TAX_PERCENT}% tax) · appt ${appt.id}`,
        });
        if (payment.status === "COMPLETED" || payment.status === "APPROVED") chargedCents = totalFee;
        else chargeError = `Charge status: ${payment.status}`;
      } catch (e) {
        chargeError = e instanceof Error ? e.message : String(e);
      }
    }

    const updates: { status: "cancelled" | "no_show"; cancellation_fee_charged_cents?: number; no_show_fee_charged_cents?: number } =
      { status: newStatus };
    if (data.kind === "cancel") updates.cancellation_fee_charged_cents = chargedCents;
    else updates.no_show_fee_charged_cents = chargedCents;

    const { error } = await supabaseAdmin.from("appointments").update(updates).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, charged_cents: chargedCents, fee_cents: fee, charge_error: chargeError };
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    starts_at: z.string(),
    barber_id: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt } = await supabaseAdmin.from("appointments").select("duration_min").eq("id", data.id).single();
    if (!appt) throw new Error("Appointment not found");
    const starts = new Date(data.starts_at);
    const ends = new Date(starts.getTime() + appt.duration_min * 60000);
    const updates: { starts_at: string; ends_at: string; barber_id?: string } = {
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
    };
    if (data.barber_id) updates.barber_id = data.barber_id;
    const { error } = await supabaseAdmin.from("appointments").update(updates).eq("id", data.id);
    if (error) throw new Error(error.message.includes("appt_no_overlap") ? "That slot conflicts with another booking." : error.message);
    return { ok: true };
  });

// ============ Services CRUD ============
const serviceInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(600).nullable().optional(),
  price_cents: z.number().int().min(0).max(1_000_000),
  duration_min: z.number().int().min(5).max(600),
  buffer_min: z.number().int().min(0).max(60).optional(),
  category: z.string().min(1).max(40),
  active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});
export const upsertService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => serviceInput.parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("services").upsert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });
export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Soft delete = deactivate to preserve appointment history
    await supabaseAdmin.from("services").update({ active: false }).eq("id", data.id);
    return { ok: true };
  });

// ============ Barbers CRUD ============
const barberInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  bio: z.string().max(800).nullable().optional(),
  specialty: z.string().max(200).nullable().optional(),
  experience_years: z.number().int().min(0).max(80).nullable().optional(),
  photo_url: z.string().max(500).nullable().optional(),
  active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
  location_ids: z.array(z.string().uuid()).min(1),
});
export const upsertBarber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => barberInput.parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { location_ids, ...b } = data;
    const { data: row, error } = await supabaseAdmin.from("barbers").upsert(b).select("id").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("barber_locations").delete().eq("barber_id", row!.id);
    if (location_ids.length > 0) {
      await supabaseAdmin.from("barber_locations").insert(location_ids.map((lid) => ({ barber_id: row!.id, location_id: lid })));
    }
    return { id: row!.id };
  });
export const deleteBarber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("barbers").update({ active: false }).eq("id", data.id);
    return { ok: true };
  });

// ============ Schedules ============
const scheduleInput = z.object({
  barber_id: z.string().uuid(),
  entries: z.array(z.object({
    location_id: z.string().uuid(),
    weekday: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  })),
});
export const setBarberSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scheduleInput.parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("barber_schedules").delete().eq("barber_id", data.barber_id);
    if (data.entries.length > 0) {
      await supabaseAdmin.from("barber_schedules").insert(data.entries.map((e) => ({ ...e, barber_id: data.barber_id })));
    }
    return { ok: true };
  });

// ============ Barber time off ============
export const addBarberTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    barber_id: z.string().uuid(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cover full days in the shop's timezone (America/New_York), DST-aware.
    const nyMidnight = (dateISO: string) => {
      const guess = new Date(`${dateISO}T00:00:00Z`);
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).formatToParts(guess);
      const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
      const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
      const offset = asUtc - guess.getTime();
      return guess.getTime() - offset;
    };
    const nextDay = (dateISO: string) => {
      const d = new Date(`${dateISO}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    };
    const start_at = new Date(nyMidnight(data.start_date)).toISOString();
    const end_at = new Date(nyMidnight(nextDay(data.end_date)) - 1).toISOString();
    const { error } = await supabaseAdmin.from("barber_time_off").insert({
      barber_id: data.barber_id, start_at, end_at, reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const removeBarberTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("barber_time_off").delete().eq("id", data.id);
    return { ok: true };
  });

// ============ Settings ============
const settingsInput = z.object({
  require_card: z.boolean(),
  require_deposit: z.boolean(),
  deposit_cents: z.number().int().min(0).max(100000),
  cancellation_window_hours: z.number().int().min(0).max(168),
  cancellation_fee_cents: z.number().int().min(0).max(100000),
  no_show_fee_cents: z.number().int().min(0).max(100000),
  auto_confirm: z.boolean(),
  max_days_ahead: z.number().int().min(1).max(365),
});
export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsInput.parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("business_settings").update(data).eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Holidays ============
export const addHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().max(200).optional(),
    location_id: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("holidays").insert({
      date: data.date, reason: data.reason ?? null, location_id: data.location_id ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const removeHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("holidays").delete().eq("id", data.id);
    return { ok: true };
  });

// ============ Full config load ============
export const getAdminConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [locations, services, barbers, barberLocs, schedules, settings, holidays, timeOff] = await Promise.all([
      supabaseAdmin.from("locations").select("*").order("sort_order"),
      supabaseAdmin.from("services").select("*").order("sort_order"),
      supabaseAdmin.from("barbers").select("*").order("sort_order"),
      supabaseAdmin.from("barber_locations").select("*"),
      supabaseAdmin.from("barber_schedules").select("*"),
      supabaseAdmin.from("business_settings").select("*").single(),
      supabaseAdmin.from("holidays").select("*").order("date"),
      supabaseAdmin.from("barber_time_off").select("*").order("start_at"),
    ]);
    return {
      locations: locations.data ?? [],
      services: services.data ?? [],
      barbers: barbers.data ?? [],
      barber_locations: barberLocs.data ?? [],
      barber_schedules: schedules.data ?? [],
      settings: settings.data ?? null,
      holidays: holidays.data ?? [],
      barber_time_off: timeOff.data ?? [],
    };
  });
