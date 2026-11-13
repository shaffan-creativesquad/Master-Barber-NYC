import { BUSINESS, LOCATIONS } from "@/lib/site-data";
import { ContactForm } from "./ContactForm";
import { Phone, MapPin, Mail, Clock, CalendarCheck } from "lucide-react";
import { SITE_IMAGES } from "@/lib/site-images";

type Props = { heading?: string; sub?: string };

export function CTAFooter({
  heading = "Reserve your chair.",
  sub = "Book your appointment in under a minute. Members always get first pick of every slot at both Brooklyn locations.",
}: Props) {
  return (
    <section id="book" className="section-bg relative overflow-hidden bg-ink text-cream">
      <div
        className="section-bg-image-faint"
        style={{ backgroundImage: `url(${SITE_IMAGES.about})` }}
      />
      <div className="section-bg-fade" />

      <div className="container-x relative grid gap-16 py-20 md:grid-cols-[1.05fr_1fr] md:gap-20 md:py-24">

        {/* LEFT, Editorial info column */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-gold">
            <CalendarCheck className="h-3 w-3" />
            Book an Appointment
          </div>
          <h2 className="mt-6 font-display text-5xl leading-[1.02] text-cream md:text-7xl">
            {heading.split(" ").slice(0, -1).join(" ")}{" "}
            <span className="two-tone-accent">
              {heading.split(" ").slice(-1)[0]}
            </span>
          </h2>
          <div className="hairline mt-8 max-w-24" />
          <p className="mt-8 max-w-md text-base leading-8 text-cream/72">{sub}</p>

          <div className="mt-10 space-y-4 text-sm">
            <a
              href={BUSINESS.phoneHref}
              className="flex items-center gap-4 text-cream transition hover:text-gold"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                <Phone className="h-4 w-4" />
              </span>
              <span>
                <div className="text-[10px] uppercase tracking-[0.28em] text-cream/50">
                  Call the shop
                </div>
                <div className="font-display text-xl">{BUSINESS.phone}</div>
              </span>
            </a>
            <a
              href={`mailto:${BUSINESS.email}`}
              className="flex items-center gap-4 text-cream transition hover:text-gold"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                <Mail className="h-4 w-4" />
              </span>
              <span>
                <div className="text-[10px] uppercase tracking-[0.28em] text-cream/50">
                  Email
                </div>
                <div className="font-display text-xl">{BUSINESS.email}</div>
              </span>
            </a>
          </div>

          <div className="my-10 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

          <div className="grid gap-8 sm:grid-cols-2">
            {LOCATIONS.map((l) => (
              <div key={l.name}>
                <div className="flex items-center gap-2 text-cream">
                  <MapPin className="h-3.5 w-3.5 text-gold" />
                  <div className="font-display text-lg">{l.name}</div>
                </div>
                <div className="mt-2 text-xs leading-6 text-white">{l.address}</div>
                <a href={l.phoneHref} className="mt-2 inline-flex items-center gap-2 text-xs text-white transition hover:text-gold">
                  <Phone className="h-3 w-3 text-gold" /> {l.phone}
                </a>
                <div className="mt-3 space-y-1.5 text-[11px] text-white/80">
                  {l.hours.map((h) => (
                    <div key={h.day} className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-3 w-3 text-gold/70" />
                      <span className="w-20">{h.day}</span>
                      <span>{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT, Booking card */}
        <div className="relative">
          <div className="pointer-events-none absolute -inset-3 rounded-[8px] bg-gradient-to-b from-gold/25 via-transparent to-transparent blur-2xl opacity-40" />
          <div className="relative rounded-sm border border-white/10 bg-charcoal/85 p-7 backdrop-blur-xl md:p-10">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Reserve your chair</div>
                <h3 className="mt-2 font-display text-3xl text-cream">
                  Book an appointment
                </h3>
              </div>
              <span className="hidden h-11 w-11 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold md:grid">
                <CalendarCheck className="h-4 w-4" />
              </span>
            </div>
            <div className="hairline mt-4 max-w-16" />
            <div className="mt-8">
              <ContactForm variant="dark" />
            </div>
            <p className="mt-5 text-center text-[11px] uppercase tracking-[0.28em] text-cream/45">
              We confirm your booking within one business day
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
