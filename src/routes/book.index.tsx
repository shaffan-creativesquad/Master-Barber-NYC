import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBookingCatalog, getAvailability, createBooking, createMemberBooking, getBarbersForSlot } from "@/lib/booking.functions";
import { getMyBookingProfile } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { saveBookingCard } from "@/lib/square.functions";
import { SquareCardForm } from "@/components/square-card";
import { PageHero } from "@/components/site/PageHero";
import { SITE_IMAGES } from "@/lib/site-images";
import { MapPin, Clock, Scissors, User, Calendar, ChevronRight, ChevronLeft, CreditCard, Check, Loader2 } from "lucide-react";

type BookSearch = { service?: string; location?: string; barber?: string };

export const Route = createFileRoute("/book/")({
  validateSearch: (search: Record<string, unknown>): BookSearch => ({
    service: typeof search.service === "string" ? search.service : undefined,
    location: typeof search.location === "string" ? search.location : undefined,
    barber: typeof search.barber === "string" ? search.barber : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Book an Appointment | Master Barber NYC" },
      { name: "description", content: "Reserve a chair at Master Barber NYC. Choose your location, service, barber and time in under a minute." },
      { property: "og:title", content: "Book an Appointment | Master Barber NYC" },
      { property: "og:description", content: "Reserve a chair at Master Barber NYC." },
      { property: "og:url", content: "https://masterbarbernyc.com/book" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/book" }],
  }),
  component: BookPage,
});


type Catalog = Awaited<ReturnType<typeof getBookingCatalog>>;
type Slot = { time: string; barber_id: string; disabled?: boolean; reason?: string };

type Wizard = {
  step: number;
  location_id: string | null;
  service_id: string | null;
  barber_id: string | null; // null = No Preference
  date: string | null;      // YYYY-MM-DD
  slot: Slot | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
  accept_policy: boolean;
  square_customer_id: string | null;
  square_card_id: string | null;
};

const initial: Wizard = {
  step: 1,
  location_id: null,
  service_id: null,
  barber_id: null,
  date: null,
  slot: null,
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  notes: "",
  accept_policy: false,
  square_customer_id: null,
  square_card_id: null,
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const SHOP_TZ = "America/New_York";

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: SHOP_TZ });
}

function BookPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const catalogFn = useServerFn(getBookingCatalog);
  const availFn = useServerFn(getAvailability);
  const barbersSlotFn = useServerFn(getBarbersForSlot);
  const createFn = useServerFn(createBooking);
  const createMemberFn = useServerFn(createMemberBooking);
  const profileFn = useServerFn(getMyBookingProfile);
  const [member, setMember] = useState<{ first_name: string; last_name: string } | null>(null);

  // Signed-in members: prefill contact details from their customer record.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      try {
        const p = await profileFn();
        if (cancelled || !p) return;
        setMember({ first_name: p.first_name, last_name: p.last_name });
        setState((s) => ({ ...s, first_name: p.first_name, last_name: p.last_name, email: p.email, phone: p.phone }));
      } catch { /* fall back to guest flow */ }
    });
    return () => { cancelled = true; };
  }, [profileFn]);

  async function signOutMember() {
    await supabase.auth.signOut();
    setMember(null);
    setState((s) => ({ ...s, first_name: "", last_name: "", email: "", phone: "" }));
  }

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<Wizard>(initial);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotBarbers, setSlotBarbers] = useState<Awaited<ReturnType<typeof getBarbersForSlot>>["barbers"]>([]);
  const [loadingBarbers, setLoadingBarbers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preferredBarberId = useRef<string | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    catalogFn().then(setCatalog).catch((e) => setError(String(e?.message ?? e)));
  }, [catalogFn]);

  // Pre-select location / service / barber passed in via the URL (deep links from CTAs)
  useEffect(() => {
    if (!catalog || prefilled.current) return;
    prefilled.current = true;
    const norm = (v: string) => v.trim().toLowerCase();
    const loc = search.location ? catalog.locations.find((l) => norm(l.name) === norm(search.location!)) : undefined;
    const svc = search.service ? catalog.services.find((s) => norm(s.name) === norm(search.service!)) : undefined;
    const bar = search.barber ? catalog.barbers.find((b) => norm(b.name) === norm(search.barber!)) : undefined;
    if (bar) preferredBarberId.current = bar.id;
    if (!loc && !svc) return;
    setState((s) => ({
      ...s,
      location_id: loc?.id ?? s.location_id,
      service_id: svc?.id ?? s.service_id,
      step: loc && svc ? 3 : loc ? 2 : 1,
    }));
  }, [catalog, search.location, search.service, search.barber]);

  // Auto-select the preferred barber once availability for the chosen slot is known
  useEffect(() => {
    if (!preferredBarberId.current || state.barber_id || slotBarbers.length === 0) return;
    const match = slotBarbers.find((b) => b.id === preferredBarberId.current && b.available);
    if (match) setState((s) => ({ ...s, barber_id: match.id }));
  }, [slotBarbers, state.barber_id]);


  // Load time slots when user reaches Step 4 (Time)
  useEffect(() => {
    if (state.step === 4 && state.location_id && state.service_id && state.date) {
      setLoadingSlots(true);
      setSlots([]);
      availFn({
        data: {
          location_id: state.location_id,
          service_id: state.service_id,
          barber_id: null,
          date: state.date,
        },
      })
        .then((r) => setSlots(r.slots))
        .catch((e) => setError(String(e?.message ?? e)))
        .finally(() => setLoadingSlots(false));
    }
  }, [state.step, state.location_id, state.service_id, state.date, availFn]);

  // Load barbers for chosen slot when user reaches Step 5 (Barber)
  useEffect(() => {
    if (state.step === 5 && state.location_id && state.service_id && state.date && state.slot) {
      setLoadingBarbers(true);
      setSlotBarbers([]);
      barbersSlotFn({
        data: {
          location_id: state.location_id,
          service_id: state.service_id,
          date: state.date,
          starts_at: state.slot.time,
        },
      })
        .then((r) => setSlotBarbers(r.barbers))
        .catch((e) => setError(String(e?.message ?? e)))
        .finally(() => setLoadingBarbers(false));
    }
  }, [state.step, state.location_id, state.service_id, state.date, state.slot, barbersSlotFn]);

  const selectedLocation = useMemo(() => catalog?.locations.find((l) => l.id === state.location_id), [catalog, state.location_id]);
  const selectedService = useMemo(() => catalog?.services.find((s) => s.id === state.service_id), [catalog, state.service_id]);
  const selectedBarber = useMemo(() => catalog?.barbers.find((b) => b.id === state.barber_id), [catalog, state.barber_id]);

  function next() { setState((s) => ({ ...s, step: s.step + 1 })); setError(null); }
  function back() { setState((s) => ({ ...s, step: Math.max(1, s.step - 1) })); setError(null); }

  async function submit() {
    if (!state.location_id || !state.service_id || !state.slot || !state.barber_id) return;
    setSubmitting(true); setError(null);
    try {
      const common = {
        location_id: state.location_id,
        service_id: state.service_id,
        barber_id: state.barber_id,
        starts_at: state.slot.time,
        notes: state.notes.trim() || undefined,
        accept_policy: true as const,
        square_customer_id: state.square_customer_id ?? undefined,
        square_card_id: state.square_card_id ?? undefined,
      };
      const res = member ? await createMemberFn({ data: common }) : await createFn({
        data: {
          location_id: state.location_id,
          service_id: state.service_id,
          barber_id: state.barber_id,
          starts_at: state.slot.time,
          first_name: state.first_name.trim(),
          last_name: state.last_name.trim(),
          email: state.email.trim(),
          phone: state.phone.trim(),
          notes: state.notes.trim() || undefined,
          accept_policy: true as const,
          square_customer_id: state.square_customer_id ?? undefined,
          square_card_id: state.square_card_id ?? undefined,
        },
      });
      navigate({ to: "/thank-you/book/success/$id", params: { id: res.id } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      
      <PageHero
        eyebrow="Reserve"
        title={<>Book an appointment</>}
        intro="Pick a location, choose your service and lock in a time. Under a minute, no phone calls."
        image={SITE_IMAGES.hero}
      />

      <section className="bg-ink text-cream">
        <div className="container-x py-16 md:py-20">
          <Stepper step={state.step} />

          <div className="mx-auto mt-10 max-w-4xl">
            {!catalog ? (
              <div className="flex items-center justify-center py-24 text-cream/60">
                <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                {state.step === 1 && (
                  <StepLocation
                    catalog={catalog}
                    selected={state.location_id}
                    onSelect={(id) => setState((s) => ({ ...s, location_id: id, barber_id: null, slot: null, date: null, step: 2 }))}
                  />
                )}
                {state.step === 2 && (
                  <StepService
                    catalog={catalog}
                    selected={state.service_id}
                    onSelect={(id) => setState((s) => ({ ...s, service_id: id, barber_id: null, slot: null, step: 3 }))}
                    onBack={back}
                  />
                )}
                {state.step === 3 && (
                  <StepDate
                    catalog={catalog}
                    locationId={state.location_id!}
                    value={state.date}
                    onSelect={(d) => setState((s) => ({ ...s, date: d, slot: null, barber_id: null, step: 4 }))}
                    onBack={back}
                  />
                )}
                {state.step === 4 && (
                  <StepTime
                    date={state.date!}
                    slots={slots}
                    loading={loadingSlots}
                    selected={state.slot?.time ?? null}
                    onSelect={(slot) => setState((s) => ({ ...s, slot, barber_id: null, step: 5 }))}
                    onBack={back}
                  />
                )}
                {state.step === 5 && (
                  <StepBarberForSlot
                    barbers={slotBarbers}
                    loading={loadingBarbers}
                    selected={state.barber_id}
                    onSelect={(id) => setState((s) => ({ ...s, barber_id: id, step: 6 }))}
                    onBack={back}
                  />
                )}
                {state.step === 6 && (
                  <StepCustomer state={state} setState={setState} onBack={back} onNext={next} member={member} onSignOut={signOutMember} />
                )}
                {state.step === 7 && (
                  <StepPayment
                    state={state}
                    setState={setState}
                    onBack={back}
                    onNext={next}
                  />
                )}
                {state.step === 8 && (
                  <StepConfirm
                    summary={{
                      location: selectedLocation?.name ?? "",
                      address: selectedLocation?.address ?? "",
                      service: selectedService?.name ?? "",
                      price_cents: selectedService?.price_cents ?? 0,
                      duration: selectedService?.duration_min ?? 0,
                      barber: selectedBarber?.name ?? "",
                      starts_at: state.slot?.time ?? "",
                    }}
                    error={error}
                    submitting={submitting}
                    onBack={back}
                    onSubmit={submit}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </section>
      
    </>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Location", "Service", "Date", "Time", "Barber", "Details", "Payment", "Confirm"];
  return (
    <ol className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[10px] uppercase tracking-[0.24em] text-cream/50">
      {labels.map((l, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={l} className="flex items-center gap-2">
            <span className={"grid h-6 w-6 place-items-center rounded-full border text-[10px] " + (active ? "border-gold bg-gold text-ink" : done ? "border-gold/60 bg-gold/15 text-gold" : "border-white/15 text-cream/50")}>
              {done ? <Check className="h-3 w-3" /> : n}
            </span>
            <span className={active ? "text-gold" : done ? "text-cream/70" : ""}>{l}</span>
            {n < labels.length && <ChevronRight className="h-3 w-3 text-cream/25" />}
          </li>
        );
      })}
    </ol>
  );
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="mt-8 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-cream/60 transition hover:text-gold">
      <ChevronLeft className="h-4 w-4" /> Back
    </button>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <div className="eyebrow text-gold">{eyebrow}</div>
      <h2 className="mt-3 font-display text-3xl md:text-4xl">{title}</h2>
    </div>
  );
}

function StepLocation({ catalog, selected, onSelect }: { catalog: Catalog; selected: string | null; onSelect: (id: string) => void }) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div>
      <SectionTitle eyebrow="Step 1" title="Choose your location" />
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {catalog.locations.map((loc) => {
          const hours = catalog.location_hours
            .filter((h) => h.location_id === loc.id)
            .sort((a, b) => a.weekday - b.weekday);
          const active = selected === loc.id;
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => onSelect(loc.id)}
              className={"group relative overflow-hidden rounded-sm border p-8 text-left transition " + (active ? "border-gold bg-white/[0.03]" : "border-white/10 bg-white/[0.02] hover:border-gold/50")}
            >
              <div className="flex items-center gap-3 text-gold">
                <MapPin className="h-4 w-4" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em]">Location</span>
              </div>
              <div className="mt-4 font-display text-2xl">{loc.name}</div>
              <div className="mt-2 text-sm text-cream/65">{loc.address}</div>
              <div className="mt-6 space-y-1 text-xs text-cream/55">
                {hours.map((h) => (
                  <div key={h.weekday} className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-3 w-3 text-gold/70" />
                    <span className="w-10">{dayNames[h.weekday]}</span>
                    <span>{h.closed ? "Closed" : `${h.open_time?.slice(0, 5)} – ${h.close_time?.slice(0, 5)}`}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                Book here <ChevronRight className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepService({ catalog, selected, onSelect, onBack }: { catalog: Catalog; selected: string | null; onSelect: (id: string) => void; onBack: () => void }) {
  const [tab, setTab] = useState<"haircut" | "razor">("haircut");
  const list = catalog.services.filter((s) => s.category === tab);
  return (
    <div>
      <SectionTitle eyebrow="Step 2" title="Choose a service" />
      <div className="mt-6 flex justify-center gap-2">
        {(["haircut", "razor"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={"rounded-full border px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition " + (tab === t ? "border-gold bg-gold/15 text-gold" : "border-white/10 text-cream/60 hover:border-gold/50")}
          >{t === "haircut" ? "Haircuts" : "Razor Work"}</button>
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {list.map((svc) => {
          const active = selected === svc.id;
          return (
            <button key={svc.id} type="button" onClick={() => onSelect(svc.id)}
              className={"group flex flex-col rounded-sm border p-6 text-left transition " + (active ? "border-gold bg-white/[0.04]" : "border-white/10 bg-white/[0.02] hover:border-gold/50")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-display text-xl">{svc.name}</div>
                <div className="font-numeric text-lg text-gold">{money(svc.price_cents)}</div>
              </div>
              {svc.description && <div className="mt-2 text-sm leading-6 text-cream/60">{svc.description}</div>}
              <div className="mt-4 text-[10px] uppercase tracking-[0.24em] text-cream/45">{svc.duration_min} min</div>
            </button>
          );
        })}
      </div>
      <BackBtn onBack={onBack} />
    </div>
  );
}

type SlotBarber = Awaited<ReturnType<typeof getBarbersForSlot>>["barbers"][number];

function StepBarberForSlot({ barbers, loading, selected, onSelect, onBack }: { barbers: SlotBarber[]; loading: boolean; selected: string | null; onSelect: (id: string) => void; onBack: () => void }) {
  const available = barbers.filter((b) => b.available);
  const unavailable = barbers.filter((b) => !b.available);
  return (
    <div>
      <SectionTitle eyebrow="Step 5" title="Choose your barber" />
      {loading ? (
        <div className="flex items-center justify-center py-16 text-cream/60"><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Checking availability…</div>
      ) : barbers.length === 0 ? (
        <div className="mt-8 rounded-sm border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-cream/60">
          No barbers at this location. Please go back and pick another.
        </div>
      ) : (
        <>
          <div className="mt-10">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cream/60">Available ({available.length})</div>
            </div>
            {available.length === 0 ? (
              <div className="rounded-sm border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-cream/60">
                No barbers free at this time. Please go back and choose another slot.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {available.map((b) => {
                  const active = selected === b.id;
                  return (
                    <button key={b.id} type="button" onClick={() => onSelect(b.id)}
                      className={"group flex flex-col rounded-sm border p-6 text-left transition " + (active ? "border-gold bg-white/[0.04]" : "border-white/10 bg-white/[0.02] hover:border-gold/50")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                          {b.photo_url ? <img src={b.photo_url} alt="" className="h-full w-full rounded-full object-cover" /> : <User className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="font-display text-lg">{b.name}</div>
                          {b.specialty && <div className="text-xs text-cream/55">{b.specialty}</div>}
                        </div>
                      </div>
                      {b.bio && <div className="mt-4 text-sm leading-6 text-cream/60">{b.bio}</div>}
                      {b.experience_years != null && (
                        <div className="mt-4 text-[10px] uppercase tracking-[0.24em] text-cream/45">{b.experience_years}+ years</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {unavailable.length > 0 && (
            <div className="mt-12">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-cream/30" />
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cream/50">Unavailable ({unavailable.length})</div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {unavailable.map((b) => (
                  <div key={b.id} aria-disabled className="relative flex cursor-not-allowed flex-col rounded-sm border border-white/5 bg-white/[0.015] p-6 text-left opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-cream/40 grayscale">
                        {b.photo_url ? <img src={b.photo_url} alt="" className="h-full w-full rounded-full object-cover" /> : <User className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="font-display text-lg text-cream/70">{b.name}</div>
                        {b.specialty && <div className="text-xs text-cream/40">{b.specialty}</div>}
                      </div>
                    </div>
                    <div className="mt-4 inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-cream/60">
                      {b.reason ?? "Unavailable"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <BackBtn onBack={onBack} />
    </div>
  );
}

function StepDate({ catalog, locationId, value, onSelect, onBack }: { catalog: Catalog; locationId: string; value: string | null; onSelect: (d: string) => void; onBack: () => void }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (catalog.settings?.max_days_ahead ?? 30));

  const closedWeekdays = new Set(catalog.location_hours.filter((h) => h.location_id === locationId && h.closed).map((h) => h.weekday));
  const holidays = new Set(catalog.holidays.filter((h) => !("location_id" in h) || (h as { location_id?: string }).location_id === locationId || (h as { location_id?: string | null }).location_id == null).map((h) => (h as { date: string }).date));

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const monthLabel = base.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div>
      <SectionTitle eyebrow="Step 3" title="Pick a date" />
      <div className="mx-auto mt-10 max-w-xl rounded-sm border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setMonthOffset((m) => Math.max(0, m - 1))} className="rounded-full p-2 text-cream/60 hover:text-gold disabled:opacity-30" disabled={monthOffset === 0}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="font-display text-xl">{monthLabel}</div>
          <button type="button" onClick={() => setMonthOffset((m) => m + 1)} className="rounded-full p-2 text-cream/60 hover:text-gold">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-[0.2em] text-cream/40">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const iso = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`;
            const dow = c.getDay();
            const past = c < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const tooFar = c > maxDate;
            const closed = closedWeekdays.has(dow) || holidays.has(iso);
            const disabled = past || tooFar || closed;
            const active = value === iso;
            return (
              <button key={i} type="button" disabled={disabled} onClick={() => onSelect(iso)}
                className={"aspect-square rounded-sm text-sm transition " + (
                  disabled ? "cursor-not-allowed text-cream/20"
                    : active ? "bg-gold text-ink"
                    : "text-cream/85 hover:bg-white/8 hover:text-gold"
                )}
              >{c.getDate()}</button>
            );
          })}
        </div>
      </div>
      <BackBtn onBack={onBack} />
    </div>
  );
}

function StepTime({ date, slots, loading, selected, onSelect, onBack }: { date: string; slots: Slot[]; loading: boolean; selected: string | null; onSelect: (s: Slot) => void; onBack: () => void }) {
  return (
    <div>
      <SectionTitle eyebrow="Step 4" title={`Available times · ${fmtDate(date)}`} />
      <div className="mx-auto mt-10 max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-cream/60"><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Finding open chairs…</div>
        ) : slots.length === 0 ? (
          <div className="rounded-sm border border-white/10 bg-white/[0.02] p-10 text-center text-cream/60">
            No open times on this date. Please pick another day.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {slots.map((s) => {
              const active = selected === s.time;
              const isDisabled = !!s.disabled;
              const title = isDisabled
                ? (s.reason === "past" ? "Too soon" : "Fully booked")
                : undefined;
              return (
                <div key={s.time + s.barber_id} className="relative">
                  <button type="button" disabled={isDisabled} title={title} onClick={() => !isDisabled && onSelect(s)}
                    className={"w-full rounded-sm border px-3 py-3 text-sm font-numeric transition " + (
                      active ? "border-gold bg-gold text-ink"
                      : isDisabled ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-cream/25"
                      : "border-white/10 bg-white/[0.03] text-cream hover:border-gold/60 hover:text-gold"
                    )}
                  >{fmtTime(s.time)}</button>
                  {isDisabled && s.reason !== "past" && (
                    <div className="mt-1 text-center text-[9px] uppercase tracking-[0.18em] text-cream/35">Fully booked</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BackBtn onBack={onBack} />
    </div>
  );
}

function StepCustomer({ state, setState, onBack, onNext, member, onSignOut }: { state: Wizard; setState: React.Dispatch<React.SetStateAction<Wizard>>; onBack: () => void; onNext: () => void; member: { first_name: string; last_name: string } | null; onSignOut: () => void }) {
  const valid = (member || (state.first_name.trim() && state.last_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim()) && state.phone.trim().length >= 7)) && state.accept_policy;
  return (
    <div>
      <SectionTitle eyebrow="Step 6" title="Your details" />
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onNext(); }} className="mx-auto mt-10 grid max-w-2xl gap-4">
        {member ? (
          <div className="rounded-sm border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-cream">
            Booking as <span className="font-semibold">{member.first_name} {member.last_name}</span> ·{" "}
            <button type="button" onClick={onSignOut} className="text-gold underline-offset-4 hover:underline">Not you? Sign out</button>
          </div>
        ) : (<>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" value={state.first_name} onChange={(v) => setState((s) => ({ ...s, first_name: v }))} />
          <Field label="Last name" value={state.last_name} onChange={(v) => setState((s) => ({ ...s, last_name: v }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" type="tel" value={state.phone} onChange={(v) => setState((s) => ({ ...s, phone: v }))} />
          <Field label="Email" type="email" value={state.email} onChange={(v) => setState((s) => ({ ...s, email: v }))} />
        </div>
        </>)}
        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/60">Notes (optional)</span>
          <textarea rows={3} value={state.notes} onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            className="w-full rounded-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-gold focus:outline-none" />
        </label>
        <label className="mt-2 flex items-start gap-3 text-sm text-cream/70">
          <input type="checkbox" checked={state.accept_policy} onChange={(e) => setState((s) => ({ ...s, accept_policy: e.target.checked }))}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-gold focus:ring-gold" />
          <span>I agree to the 24-hour cancellation policy. A fee may apply for late cancellations or no-shows.</span>
        </label>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-cream/60 hover:text-gold">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button type="submit" disabled={!valid} className="btn-gold disabled:cursor-not-allowed disabled:opacity-40">Continue</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/60">{label}</span>
      <input required type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-gold focus:outline-none" />
    </label>
  );
}

function StepPayment({ state, setState, onBack, onNext }: { state: Wizard; setState: React.Dispatch<React.SetStateAction<Wizard>>; onBack: () => void; onNext: () => void }) {
  const saveCardFn = useServerFn(saveBookingCard);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div>
      <SectionTitle eyebrow="Step 7" title="Card on file" />
      <div className="mx-auto mt-10 max-w-2xl rounded-sm border border-white/10 bg-white/[0.02] p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="text-sm leading-7 text-cream/75">
            <div className="font-display text-lg text-cream">Your card will not be charged today</div>
            We hold your card on file to protect the chair. A fee only applies if you cancel after the 24-hour window or don't show.
          </div>
        </div>

        {err && <div className="mt-6 rounded-sm border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>}

        <div className="mt-6">
          <SquareCardForm
            buttonLabel="Save card & continue"
            intent="STORE"
            cardholder={`${state.first_name} ${state.last_name}`.trim()}
            email={state.email}
            onError={setErr}
            onToken={async ({ source_id, verification_token }) => {
              setErr(null);
              const res = await saveCardFn({
                data: {
                  first_name: state.first_name.trim(),
                  last_name: state.last_name.trim(),
                  email: state.email.trim(),
                  phone: state.phone.trim(),
                  source_id,
                  verification_token,
                },
              });
              setState((s) => ({
                ...s,
                square_customer_id: res.square_customer_id,
                square_card_id: res.square_card_id,
              }));
              onNext();
            }}
          />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-cream/60 hover:text-gold">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <span className="text-[10px] uppercase tracking-[0.24em] text-cream/40">Secured by Square</span>
        </div>
      </div>
    </div>
  );
}

function StepConfirm({ summary, error, submitting, onBack, onSubmit }: {
  summary: { location: string; address: string; service: string; price_cents: number; duration: number; barber: string; starts_at: string };
  error: string | null; submitting: boolean; onBack: () => void; onSubmit: () => void;
}) {
  const ends = new Date(new Date(summary.starts_at).getTime() + summary.duration * 60000);
  return (
    <div>
      <SectionTitle eyebrow="Step 8" title="Confirm your booking" />
      <div className="mx-auto mt-10 max-w-2xl rounded-sm border border-white/10 bg-white/[0.02] p-8">
        <Row icon={<MapPin className="h-4 w-4" />} label="Location" value={summary.location} sub={summary.address} />
        <Row icon={<Scissors className="h-4 w-4" />} label="Service" value={summary.service} sub={`${summary.duration} min · ${money(summary.price_cents)}`} />
        <Row icon={<User className="h-4 w-4" />} label="Barber" value={summary.barber} />
        <Row icon={<Calendar className="h-4 w-4" />} label="Date & time" value={`${new Date(summary.starts_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: SHOP_TZ })}`} sub={`${fmtTime(summary.starts_at)} – ${fmtTime(ends.toISOString())}`} />
        {error && <div className="mt-6 rounded-sm border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        <div className="mt-8 flex items-center justify-between">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-cream/60 hover:text-gold">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button type="button" onClick={onSubmit} disabled={submitting} className="btn-gold disabled:opacity-40">
            {submitting ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Booking…</> : "Confirm booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-4 border-b border-white/8 py-4 last:border-b-0">
      <div className="mt-1 grid h-9 w-9 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">{icon}</div>
      <div className="flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/50">{label}</div>
        <div className="mt-1 font-display text-lg text-cream">{value}</div>
        {sub && <div className="text-sm text-cream/60">{sub}</div>}
      </div>
    </div>
  );
}
