import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { escapeLike } from "@/lib/escape-like";

function publicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// ============ Shared availability primitives ============
// Overlap: [aStart, aEnd) intersects [bStart, bEnd) iff aStart < bEnd && aEnd > bStart.
// This is the ONE overlap rule used everywhere in the app.
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

type ApptRow = { barber_id: string; starts_at: string; ends_at: string; status: string };
type BreakRow = { barber_id: string; weekday: number | null; date: string | null; start_time: string; end_time: string };
type TimeOffRow = { barber_id: string; start_at: string; end_at: string };

function isActive(status: string) {
  return status !== "cancelled" && status !== "no_show";
}

function barberHasConflict(
  barberId: string,
  slotStart: number,
  slotEnd: number,
  dateISO: string,
  weekday: number,
  appts: ApptRow[],
  breaks: BreakRow[],
  timeoff: TimeOffRow[],
  tz: string,
): { conflict: boolean; reason?: string } {
  // Existing appointments (any location, a barber cannot be in two places).
  for (const a of appts) {
    if (a.barber_id !== barberId || !isActive(a.status)) continue;
    if (overlaps(slotStart, slotEnd, new Date(a.starts_at).getTime(), new Date(a.ends_at).getTime())) {
      return { conflict: true, reason: "booked" };
    }
  }
  // Breaks
  for (const br of breaks) {
    if (br.barber_id !== barberId) continue;
    const matchesDate = (br.date && br.date === dateISO) || (br.weekday === weekday && !br.date);
    if (!matchesDate) continue;
    const [sH, sM] = String(br.start_time).split(":").map(Number);
    const [eH, eM] = String(br.end_time).split(":").map(Number);
    const bs = dateAtHM(dateISO, sH, sM, tz);
    const be = dateAtHM(dateISO, eH, eM, tz);
    if (overlaps(slotStart, slotEnd, bs, be)) return { conflict: true, reason: "break" };
  }
  // Time off / vacation
  for (const t of timeoff) {
    if (t.barber_id !== barberId) continue;
    if (overlaps(slotStart, slotEnd, new Date(t.start_at).getTime(), new Date(t.end_at).getTime())) {
      return { conflict: true, reason: "off" };
    }
  }
  return { conflict: false };
}

function parseHM(hm: string) {
  const [h, m] = String(hm).split(":").map(Number);
  return { h, m };
}

const DEFAULT_TZ = "America/New_York";

// Offset (ms) of a time zone at a given instant: zoneLocalTime - utcTime.
function tzOffsetMs(utcMs: number, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUTC - utcMs;
}

// Wall-clock time (dateISO at h:m) in the shop's time zone -> UTC epoch ms.
function dateAtHM(dateISO: string, h: number, m: number, tz: string = DEFAULT_TZ) {
  const naive = Date.UTC(
    Number(dateISO.slice(0, 4)),
    Number(dateISO.slice(5, 7)) - 1,
    Number(dateISO.slice(8, 10)),
    h,
    m,
  );
  let utc = naive - tzOffsetMs(naive, tz);
  utc = naive - tzOffsetMs(utc, tz);
  return utc;
}

// ============ Schedule validation ============
/** A shift is bookable only if it has a real, positive-length time window. */
function isValidShift(s: { start_time: unknown; end_time: unknown }): boolean {
  if (!s.start_time || !s.end_time) return false;
  const a = parseHM(String(s.start_time));
  const b = parseHM(String(s.end_time));
  const start = a.h * 60 + a.m;
  const end = b.h * 60 + b.m;
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

// ============ Read data for the wizard ============
export const getBookingCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [locations, hours, services, barbers, barberLocs, barberSvcs, schedules, holidays, settings] = await Promise.all([
    sb.from("locations").select("id,name,address,phone,timezone,sort_order").eq("active", true).order("sort_order"),
    sb.from("location_hours").select("location_id,weekday,open_time,close_time,closed"),
    sb.from("services").select("id,name,description,price_cents,duration_min,buffer_min,category,sort_order").eq("active", true).order("sort_order"),
    sb.from("barbers").select("id,name,photo_url,bio,specialty,experience_years,sort_order").eq("active", true).order("sort_order"),
    sb.from("barber_locations").select("barber_id,location_id"),
    sb.from("barber_services").select("barber_id,service_id"),
    supabaseAdmin.from("barber_schedules").select("barber_id,location_id,weekday,start_time,end_time"),
    sb.from("holidays").select("location_id,date"),
    supabaseAdmin.from("business_settings").select("max_days_ahead,cancellation_window_hours").single(),
  ]);
  const activeIds = new Set((barbers.data ?? []).map((b) => b.id));
  return {
    locations: locations.data ?? [],
    location_hours: hours.data ?? [],
    services: services.data ?? [],
    barbers: barbers.data ?? [],
    barber_locations: (barberLocs.data ?? []).filter((x) => activeIds.has(x.barber_id)),
    barber_services: (barberSvcs.data ?? []).filter((x) => activeIds.has(x.barber_id)),
    barber_schedules: (schedules.data ?? []).filter((x) => activeIds.has(x.barber_id) && isValidShift(x)),
    holidays: holidays.data ?? [],
    settings: settings.data ?? null,
  };
});

// ============ Availability ============
const availSchema = z.object({
  location_id: z.string().uuid(),
  service_id: z.string().uuid(),
  barber_id: z.string().uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type Slot = { time: string; barber_id: string; disabled?: boolean; reason?: string };

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => availSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const dateISO = data.date;
    const weekday = new Date(dateISO + "T00:00:00Z").getUTCDay();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Widened window to capture appointments that overlap this day but started earlier.
    const winStart = new Date(dateAtHM(dateISO, 0, 0) - 86400000).toISOString();
    const winEnd = new Date(dateAtHM(dateISO, 0, 0) + 2 * 86400000).toISOString();

    const [{ data: svc }, { data: loc }, { data: sched }, apptsRes, { data: hours }, { data: holidays }, breaksRes, timeoffRes, { data: barberLocs }, { data: activeBarbers }] = await Promise.all([
      sb.from("services").select("duration_min,buffer_min").eq("id", data.service_id).single(),
      sb.from("locations").select("id,timezone,active").eq("id", data.location_id).single(),
      supabaseAdmin.from("barber_schedules").select("barber_id,start_time,end_time,location_id,weekday").eq("location_id", data.location_id).eq("weekday", weekday),
      // Barber-scoped (across ALL locations), a barber can't be double-booked anywhere.
      supabaseAdmin.from("appointments").select("barber_id,starts_at,ends_at,status").gte("starts_at", winStart).lte("starts_at", winEnd),
      sb.from("location_hours").select("open_time,close_time,closed").eq("location_id", data.location_id).eq("weekday", weekday).single(),
      sb.from("holidays").select("date").or(`location_id.eq.${data.location_id},location_id.is.null`).eq("date", dateISO),
      supabaseAdmin.from("barber_breaks").select("barber_id,weekday,date,start_time,end_time"),
      supabaseAdmin.from("barber_time_off").select("barber_id,start_at,end_at"),
      sb.from("barber_locations").select("barber_id,location_id").eq("location_id", data.location_id),
      sb.from("barbers").select("id").eq("active", true),
    ]);

    const appts = (apptsRes.data ?? []) as ApptRow[];
    const breaks = (breaksRes.data ?? []) as BreakRow[];
    const timeoff = (timeoffRes.data ?? []) as TimeOffRow[];

    if (!svc || !loc || !loc.active) return { slots: [] as Slot[] };
    if (!hours || hours.closed) return { slots: [] };
    if (holidays && holidays.length > 0) return { slots: [] };

    const tz = (loc as { timezone?: string }).timezone || DEFAULT_TZ;
    const duration = svc.duration_min;
    const buffer = (svc as { buffer_min?: number }).buffer_min ?? 0;
    const reserved = duration + buffer;
    const activeSet = new Set((activeBarbers ?? []).map((b) => b.id));
    const allowedBarbers = new Set((barberLocs ?? []).map((x) => x.barber_id).filter((id) => activeSet.has(id)));

    let barberList = (sched ?? []).filter((s) => allowedBarbers.has(s.barber_id) && isValidShift(s));
    if (data.barber_id) barberList = barberList.filter((s) => s.barber_id === data.barber_id);
    if (barberList.length === 0) return { slots: [] };

    const openT = parseHM(String(hours.open_time));
    const closeT = parseHM(String(hours.close_time));
    const openMinutes = openT.h * 60 + openT.m;
    const closeMinutes = closeT.h * 60 + closeT.m;
    const stepMinutes = 15;

    const perTime = new Map<string, Slot>();

    for (const b of barberList) {
      const bs = parseHM(String(b.start_time));
      const be = parseHM(String(b.end_time));
      const barberStart = bs.h * 60 + bs.m;
      const barberEnd = be.h * 60 + be.m;

      for (let m = openMinutes; m + reserved <= closeMinutes; m += stepMinutes) {
        const slotStart = dateAtHM(dateISO, Math.floor(m / 60), m % 60, tz);
        const slotEnd = slotStart + reserved * 60000;
        const iso = new Date(slotStart).toISOString();

        let disabled = false;
        let reason: string | undefined;

        if (m < barberStart || m + reserved > barberEnd) {
          disabled = true; reason = "off";
        } else if (slotStart < Date.now() + 60 * 60000) {
          disabled = true; reason = "past";
        } else {
          const c = barberHasConflict(b.barber_id, slotStart, slotEnd, dateISO, weekday, appts, breaks, timeoff, tz);
          if (c.conflict) { disabled = true; reason = c.reason; }
        }

        const existing = perTime.get(iso);
        if (!existing || (existing.disabled && !disabled)) {
          perTime.set(iso, { time: iso, barber_id: b.barber_id, disabled: disabled || undefined, reason });
        }
      }
    }

    return { slots: Array.from(perTime.values()).sort((a, b) => a.time.localeCompare(b.time)) };
  });

// ============ Create booking ============
const createSchema = z.object({
  location_id: z.string().uuid(),
  service_id: z.string().uuid(),
  barber_id: z.string().uuid(),
  starts_at: z.string(),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().min(7).max(30),
  notes: z.string().max(1000).optional(),
  accept_policy: z.literal(true),
  square_customer_id: z.string().optional(),
  square_card_id: z.string().optional(),
});

type BookingInput = z.infer<typeof createSchema>;

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => performBooking(data, null));

// Signed-in members: contact details come from the customers row matched to the
// verified auth email — never from the browser.
const memberCreateSchema = createSchema.omit({ first_name: true, last_name: true, email: true, phone: true });

export const createMemberBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => memberCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const email = String(context.claims["email"] ?? "").trim().toLowerCase();
    if (!email) throw new Error("Please sign in again.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cust } = await supabaseAdmin
      .from("customers").select("id,first_name,last_name,email,phone")
      .ilike("email", escapeLike(email)).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!cust) throw new Error("We could not find your member profile. Please book as a guest.");
    return performBooking(
      { ...data, first_name: cust.first_name, last_name: cust.last_name, email: cust.email, phone: cust.phone },
      cust.id,
    );
  });

async function performBooking(data: BookingInput, memberCustomerId: string | null) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: svc }, { data: loc }, { data: settings }] = await Promise.all([
      supabaseAdmin.from("services").select("id,price_cents,duration_min,buffer_min").eq("id", data.service_id).eq("active", true).single(),
      supabaseAdmin.from("locations").select("id,active").eq("id", data.location_id).single(),
      supabaseAdmin.from("business_settings").select("auto_confirm,max_days_ahead").single(),
    ]);
    if (!svc) throw new Error("Service unavailable.");
    if (!loc || !loc.active) throw new Error("This location is not available for online booking. Please call the shop to schedule.");

    const starts = new Date(data.starts_at);
    if (isNaN(starts.getTime())) throw new Error("Invalid start time.");
    const now = new Date();
    if (starts < now) throw new Error("That time has passed.");
    const maxAhead = settings?.max_days_ahead ?? 30;
    if (starts.getTime() - now.getTime() > maxAhead * 86400000) throw new Error(`Bookings only ${maxAhead} days ahead.`);

    const reservedMin = svc.duration_min + ((svc as { buffer_min?: number }).buffer_min ?? 0);
    const ends = new Date(starts.getTime() + reservedMin * 60000);

    const barberId = data.barber_id;

    // Schedule validation: barber must be active, assigned to this location,
    // on a valid shift covering the whole slot, and not on break / time off.
    {
      const { data: locTz } = await supabaseAdmin.from("locations").select("timezone").eq("id", data.location_id).single();
      const tz = locTz?.timezone || DEFAULT_TZ;
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(starts);
      const dateISO = parts; // YYYY-MM-DD
      const weekday = new Date(dateISO + "T00:00:00Z").getUTCDay();
      const [{ data: barber }, { data: bl }, { data: shifts }, { data: hrs }, { data: hol }, breaksRes, timeoffRes] = await Promise.all([
        supabaseAdmin.from("barbers").select("id,active").eq("id", barberId).maybeSingle(),
        supabaseAdmin.from("barber_locations").select("barber_id").eq("barber_id", barberId).eq("location_id", data.location_id).maybeSingle(),
        supabaseAdmin.from("barber_schedules").select("start_time,end_time").eq("barber_id", barberId).eq("location_id", data.location_id).eq("weekday", weekday),
        supabaseAdmin.from("location_hours").select("closed").eq("location_id", data.location_id).eq("weekday", weekday).maybeSingle(),
        supabaseAdmin.from("holidays").select("id").or(`location_id.eq.${data.location_id},location_id.is.null`).eq("date", dateISO).limit(1),
        supabaseAdmin.from("barber_breaks").select("barber_id,weekday,date,start_time,end_time").eq("barber_id", barberId),
        supabaseAdmin.from("barber_time_off").select("barber_id,start_at,end_at").eq("barber_id", barberId),
      ]);
      const unavailable = "That barber isn't available at this time. Please pick another time or barber.";
      if (!barber || !barber.active || !bl) throw new Error(unavailable);
      if (!hrs || hrs.closed || (hol && hol.length > 0)) throw new Error("The shop is closed that day.");
      const s0 = starts.getTime(), e0 = ends.getTime();
      const covered = (shifts ?? []).some((sh) => {
        if (!isValidShift(sh)) return false;
        const a = parseHM(String(sh.start_time)), b = parseHM(String(sh.end_time));
        return s0 >= dateAtHM(dateISO, a.h, a.m, tz) && e0 <= dateAtHM(dateISO, b.h, b.m, tz);
      });
      if (!covered) throw new Error(unavailable);
      const c = barberHasConflict(barberId, s0, e0, dateISO, weekday, [] as ApptRow[], (breaksRes.data ?? []) as BreakRow[], (timeoffRes.data ?? []) as TimeOffRow[], tz);
      if (c.conflict) throw new Error(unavailable);
    }

    // Overlap check: any existing appt where existingStart < newEnd AND existingEnd > newStart.
    const { data: conflict } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("barber_id", barberId)
      .not("status", "in", "(cancelled,no_show)")
      .lt("starts_at", ends.toISOString())
      .gt("ends_at", starts.toISOString())
      .limit(1);
    if (conflict && conflict.length > 0) {
      throw new Error("That slot was just booked. Please pick another time.");
    }

    // Signed-in member: customer already resolved server-side, never modified here.
    // Guest: upsert customer by email (unchanged behaviour).
    let customerId: string | undefined = memberCustomerId ?? undefined;
    if (memberCustomerId) {
      // no-op
    } else if (!(customerId = (await supabaseAdmin
      .from("customers").select("id").eq("email", data.email.toLowerCase()).maybeSingle()).data?.id)) {
      const { data: newCust, error: cErr } = await supabaseAdmin
        .from("customers")
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email.toLowerCase(),
          phone: data.phone,
        }).select("id").single();
      if (cErr || !newCust) throw new Error(cErr?.message ?? "Could not save customer.");
      customerId = newCust.id;
    } else {
      await supabaseAdmin.from("customers").update({
        first_name: data.first_name, last_name: data.last_name, phone: data.phone,
      }).eq("id", customerId);
    }

    const { data: appt, error: aErr } = await supabaseAdmin.from("appointments").insert({
      location_id: data.location_id,
      barber_id: barberId,
      service_id: data.service_id,
      customer_id: customerId!,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: settings?.auto_confirm === false ? "pending" : "confirmed",
      notes: data.notes ?? null,
      price_cents: svc.price_cents,
      duration_min: svc.duration_min,
      square_customer_id: data.square_customer_id ?? null,
      square_card_id: data.square_card_id ?? null,
    }).select("id,starts_at,ends_at,status").single();

    if (aErr) {
      if (aErr.message.includes("appt_no_overlap")) {
        throw new Error("That slot was just booked. Please pick another time.");
      }
      throw new Error(aErr.message);
    }

    // Confirmation emails — never let a delivery issue fail the booking.
    try {
      const [{ data: sv }, { data: lc }, { data: bb }] = await Promise.all([
        supabaseAdmin.from("services").select("name").eq("id", data.service_id).maybeSingle(),
        supabaseAdmin.from("locations").select("name,address").eq("id", data.location_id).maybeSingle(),
        supabaseAdmin.from("barbers").select("name").eq("id", barberId).maybeSingle(),
      ]);
      const when = starts.toLocaleString("en-US", {
        weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
      });
      const price = `$${(svc.price_cents / 100).toFixed(2).replace(/\.00$/, "")}`;
      const ref = appt!.id.slice(0, 8).toUpperCase();
      const fullName = `${data.first_name} ${data.last_name}`.trim();
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await Promise.allSettled([
        sendTemplateEmail("booking-confirmation", data.email.toLowerCase(), {
          templateData: {
            firstName: data.first_name, service: sv?.name ?? "", price, barber: bb?.name ?? "",
            when, location: lc?.name ?? "", address: lc?.address ?? "", status: appt!.status, reference: ref,
          },
          idempotencyKey: `booking-confirmation-${appt!.id}`,
        }),
        sendTemplateEmail("shop-notification", "", {
          templateData: {
            kind: "booking",
            title: `New booking: ${fullName} — ${when}`,
            details: [
              { label: "Customer", value: fullName },
              { label: "Phone", value: data.phone },
              { label: "Email", value: data.email },
              { label: "Service", value: `${sv?.name ?? ""} · ${price}` },
              { label: "Barber", value: bb?.name ?? "" },
              { label: "Date & time", value: when },
              { label: "Location", value: lc?.name ?? "" },
              { label: "Status", value: appt!.status === "pending" ? "Needs confirmation" : "Confirmed" },
              { label: "Notes", value: data.notes ?? "" },
              { label: "Appointment #", value: ref },
            ],
          },
          replyTo: data.email,
          idempotencyKey: `shop-booking-${appt!.id}`,
        }),
      ]).then((r) => r.forEach((x) => x.status === "rejected" && console.error("Booking email failed", x.reason)));
    } catch (error) {
      console.error("Booking emails failed", error);
    }

    return { id: appt!.id, status: appt!.status, starts_at: appt!.starts_at, ends_at: appt!.ends_at, barber_id: barberId };
}

// ============ Barbers for a specific slot ============
const barbersForSlotSchema = z.object({
  location_id: z.string().uuid(),
  service_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  starts_at: z.string(),
});

export const getBarbersForSlot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => barbersForSlotSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const dateISO = data.date;
    const weekday = new Date(dateISO + "T00:00:00Z").getUTCDay();
    const slotStart = new Date(data.starts_at).getTime();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const winStart = new Date(dateAtHM(dateISO, 0, 0) - 86400000).toISOString();
    const winEnd = new Date(dateAtHM(dateISO, 0, 0) + 2 * 86400000).toISOString();

    const [{ data: svc }, { data: loc }, { data: hours }, { data: sched }, apptsRes, breaksRes, timeoffRes, { data: barberLocs }, { data: barbers }] = await Promise.all([
      sb.from("services").select("duration_min,buffer_min").eq("id", data.service_id).single(),
      sb.from("locations").select("id,active,timezone").eq("id", data.location_id).single(),
      sb.from("location_hours").select("open_time,close_time,closed").eq("location_id", data.location_id).eq("weekday", weekday).single(),
      supabaseAdmin.from("barber_schedules").select("barber_id,start_time,end_time").eq("location_id", data.location_id).eq("weekday", weekday),
      // Barber-scoped across ALL locations (a barber can only be in one place at a time).
      supabaseAdmin.from("appointments").select("barber_id,starts_at,ends_at,status").gte("starts_at", winStart).lte("starts_at", winEnd),
      supabaseAdmin.from("barber_breaks").select("barber_id,weekday,date,start_time,end_time"),
      supabaseAdmin.from("barber_time_off").select("barber_id,start_at,end_at"),
      sb.from("barber_locations").select("barber_id,location_id").eq("location_id", data.location_id),
      sb.from("barbers").select("id,name,photo_url,bio,specialty,experience_years,sort_order").eq("active", true).order("sort_order"),
    ]);

    if (!svc || !loc || !loc.active) return { barbers: [] as Array<{ id: string; name: string; photo_url: string | null; specialty: string | null; experience_years: number | null; bio: string | null; available: boolean; reason?: string }> };

    const appts = (apptsRes.data ?? []) as ApptRow[];
    const breaks = (breaksRes.data ?? []) as BreakRow[];
    const timeoff = (timeoffRes.data ?? []) as TimeOffRow[];

    const tz = (loc as { timezone?: string }).timezone || DEFAULT_TZ;
    const reserved = svc.duration_min + ((svc as { buffer_min?: number }).buffer_min ?? 0);
    const slotEnd = slotStart + reserved * 60000;
    const allowedIds = new Set((barberLocs ?? []).map((x) => x.barber_id));

    const closed = !hours || hours.closed;

    const list = (barbers ?? []).filter((b) => allowedIds.has(b.id)).map((b) => {
      let available = true;
      let reason: string | undefined;

      if (closed) { available = false; reason = "Closed"; }

      const s = (sched ?? []).find((x) => x.barber_id === b.id);
      if (available) {
        if (!s) { available = false; reason = "Day off"; }
        else {
          const bs = parseHM(String(s.start_time));
          const be = parseHM(String(s.end_time));
          const shiftStart = dateAtHM(dateISO, bs.h, bs.m, tz);
          const shiftEnd = dateAtHM(dateISO, be.h, be.m, tz);
          if (!isValidShift(s) || slotStart < shiftStart || slotEnd > shiftEnd) { available = false; reason = "Off shift"; }
        }
      }

      if (available) {
        const c = barberHasConflict(b.id, slotStart, slotEnd, dateISO, weekday, appts, breaks, timeoff, tz);
        if (c.conflict) {
          available = false;
          reason = c.reason === "booked" ? "Already booked" : c.reason === "break" ? "On break" : "On vacation";
        }
      }

      return {
        id: b.id,
        name: b.name,
        photo_url: b.photo_url ?? null,
        specialty: b.specialty ?? null,
        experience_years: b.experience_years ?? null,
        bio: b.bio ?? null,
        available,
        reason,
      };
    });

    return { barbers: list };
});

// ============ Booking confirmation page ============
const confirmSchema = z.object({ id: z.string().uuid() });

export const getBookingConfirmation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => confirmSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: appt, error: apptErr } = await supabaseAdmin
      .from("appointments")
      .select("id,status,starts_at,ends_at,price_cents,duration_min,location_id,service_id,barber_id,customer_id")
      .eq("id", data.id)
      .single();
    if (apptErr || !appt) return null;

    const [{ data: location }, { data: service }, { data: barber }, { data: customer }] = await Promise.all([
      supabaseAdmin.from("locations").select("name,address,phone").eq("id", appt.location_id).single(),
      supabaseAdmin.from("services").select("name").eq("id", appt.service_id).single(),
      supabaseAdmin.from("barbers").select("name").eq("id", appt.barber_id).single(),
      supabaseAdmin.from("customers").select("first_name,last_name").eq("id", appt.customer_id).single(),
    ]);

    return {
      id: appt.id,
      status: appt.status,
      starts_at: appt.starts_at,
      ends_at: appt.ends_at,
      price_cents: appt.price_cents,
      duration_min: appt.duration_min,
      location,
      service,
      barber,
      customer,
    };
  });
