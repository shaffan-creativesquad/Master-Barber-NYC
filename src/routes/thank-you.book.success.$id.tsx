import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Phone, MapPin, Scissors, User, Calendar, CheckCircle } from "lucide-react";
import { getBookingConfirmation } from "@/lib/booking.functions";
import { BUSINESS } from "@/lib/site-data";

const bookingConfirmationOptions = (id: string) =>
  queryOptions({
    queryKey: ["booking-confirmation", id],
    queryFn: () => getBookingConfirmation({ data: { id } }),
  });

export const Route = createFileRoute("/thank-you/book/success/$id")({
  head: () => ({
    meta: [
      { title: "Appointment Confirmed | Master Barber NYC" },
      { name: "description", content: "Your appointment at Master Barber NYC is confirmed. See you in the chair." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Appointment Confirmed | Master Barber NYC" },
      { property: "og:description", content: "Your appointment at Master Barber NYC is confirmed." },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/thank-you/book/success" }],
  }),
  loader: async ({ context, params }) => {
    const opts = bookingConfirmationOptions(params.id);
    try {
      await context.queryClient.ensureQueryData(opts);
    } catch (error) {
      console.error(`[thank-you/book] failed to load booking ${params.id}`, error);
      throw error;
    }
  },
  errorComponent: BookingLoadError,
  component: BookingSuccess,
});

function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const SHOP_TZ = "America/New_York";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: SHOP_TZ });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: SHOP_TZ });
}

function BookingSuccess() {
  const { id } = Route.useParams();
  const { data: booking } = useSuspenseQuery(bookingConfirmationOptions(id));

  if (!booking) {
    return (
      <section className="bg-ink text-cream">
        <div className="container-x flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
          <h1 className="font-display text-4xl md:text-5xl">Booking not found</h1>
          <p className="mt-4 max-w-md text-cream/70">We couldn't locate that appointment. If you just booked, check your email shortly.</p>
          <Link to="/book" className="btn-gold mt-8">Book an Appointment</Link>
        </div>
      </section>
    );
  }

  const confirmed = booking.status === "confirmed";

  return (
    <section className="bg-ink text-cream">
      <div className="container-x flex min-h-[80vh] flex-col items-center justify-center py-20 md:py-24">
        <div className="mx-auto max-w-xl text-center">
          <div className="eyebrow text-gold">{confirmed ? "Confirmed" : "Request Received"}</div>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] md:text-6xl">
            You're all set.
          </h1>
          <p className="mt-5 text-lg text-cream/75">
            Thanks, {booking.customer?.first_name || "there"}. Your chair is reserved, we’ll see you at the shop.
          </p>
        </div>

        <div className="hairline mx-auto mt-10 max-w-40" />

        <div className="mx-auto mt-10 w-full max-w-lg rounded-sm border border-white/10 bg-white/[0.02] p-8 text-left">
          <div className="mb-6 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cream/70">
              Appointment #{booking.id.slice(0, 8)}
            </span>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-gold" />
              <div>
                <div className="font-medium">{booking.location?.name}</div>
                <div className="text-cream/65">{booking.location?.address}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Scissors className="mt-0.5 h-4 w-4 text-gold" />
              <div>
                <div className="font-medium">{booking.service?.name}</div>
                <div className="text-cream/65">{money(booking.price_cents)} · {booking.duration_min} min</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 text-gold" />
              <div>
                <div className="font-medium">{booking.barber?.name}</div>
                <div className="text-cream/65">Your barber</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-4 w-4 text-gold" />
              <div>
                <div className="font-medium">{fmtDate(booking.starts_at)}</div>
                <div className="text-cream/65">{fmtTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</div>
              </div>
            </div>

            {confirmed && (
              <div className="mt-4 rounded-sm border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Your appointment is confirmed. Arrive 5 minutes early so we can get you right into the chair.
              </div>
            )}
            {!confirmed && (
              <div className="mt-4 rounded-sm border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
                Your request is pending confirmation. We'll reach out shortly to lock in your time.
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href={booking.location?.phone ? `tel:${booking.location.phone.replace(/\D/g, "")}` : BUSINESS.phoneHref}
            className="inline-flex h-12 items-center gap-2 rounded-sm bg-gold px-7 text-xs font-medium uppercase tracking-[0.24em] text-ink hover:brightness-105"
          >
            <Phone className="h-4 w-4" /> Call the Shop
          </a>
          <Link
            to="/"
            className="inline-flex h-12 items-center rounded-sm border border-cream/30 px-6 text-xs font-medium uppercase tracking-[0.24em] text-cream hover:bg-cream/10"
          >
            Return Home
          </Link>
        </div>

        <p className="mt-8 max-w-md text-center text-xs text-cream/50">
          Need to make a change? Call the shop at least 24 hours ahead and we'll move your chair.
        </p>
      </div>
    </section>
  );
}

function BookingLoadError() {
  return (
    <section className="grid min-h-[60vh] place-items-center bg-ink px-4 py-24 text-center text-cream">
      <div className="max-w-md">
        <h1 className="font-display text-3xl">Your booking went through</h1>
        <p className="mt-3 text-sm text-cream/70">
          We couldn't load the details right now, but a confirmation email is on its way. Questions? Give the shop a call.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <a href={BUSINESS.phoneHref} className="btn-gold">Call the Shop</a>
          <Link to="/" className="btn-gold">Return Home</Link>
        </div>
      </div>
    </section>
  );
}
