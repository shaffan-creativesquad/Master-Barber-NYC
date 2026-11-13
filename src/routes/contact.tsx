import { breadcrumbSchema } from "@/lib/seo-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SectionHeader } from "@/components/site/Sections";
import { BUSINESS, LOCATIONS } from "@/lib/site-data";
import { SITE_IMAGES } from "@/lib/site-images";
import { Phone, Mail, MapPin, Clock, Navigation, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Book | Master Barber NYC" },
      {
        name: "description",
        content:
          "Choose your Brooklyn barbershop, Park Slope or Downtown. Call the shop, get directions, or book your appointment online in seconds.",
      },
      { property: "og:title", content: "Contact | Master Barber NYC" },
      { property: "og:description", content: "Two Brooklyn shops. Call, get directions, or book online." },
      { property: "og:url", content: "https://masterbarbernyc.com/contact" },
      { property: "og:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { name: "twitter:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/contact" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Contact", path: "/contact" }])) },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <>
      {/* Location chooser, first thing on the page */}
      <section className="section-bg scroll-mt-28 pt-32 md:pt-40 pb-20 md:pb-28">
        <div className="section-bg-image-faint" style={{ backgroundImage: `url(${SITE_IMAGES.beard})` }} />
        <div className="section-bg-fade" />
        <div className="container-x">
          <div className="mx-auto max-w-3xl text-center">
            <div className="eyebrow">Contact</div>
            <h1 className="mt-4 font-display text-4xl leading-[1.1] text-cream md:text-6xl">
              Contact Master Barber NYC in <span className="two-tone-accent">Brooklyn</span>
            </h1>
            <p className="mt-6 text-base leading-8 text-cream/75 md:text-lg">
              Call either shop, get directions, or book online. Park Slope on 7th Ave and Downtown on Bond St, open six days a week.
            </p>
          </div>

          <SectionHeader
            align="center"
            eyebrow="Our Locations"
            title={<>Select the shop <span className="two-tone-accent">closest to you</span>.</>}
            sub="Both shops sit on high-traffic Brooklyn corners, easy on foot, by train, or a quick cab from the neighborhood."
          />


          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {LOCATIONS.map((l) => (
              <div key={l.name} className="card-ivory overflow-hidden rounded-2xl">
                <iframe
                  title={`Master Barber NYC, ${l.name} map`}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(l.mapQuery)}&output=embed`}
                  className="h-[280px] w-full md:h-[320px]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="space-y-4 p-6 md:p-8">
                  <h3 className="plan-title text-2xl">{l.name}</h3>

                  <div className="ivory-text flex items-start gap-3 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
                    <span>{l.address}</span>
                  </div>

                  <div className="ivory-text flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-gold-deep" />
                    <a href={l.phoneHref} className="font-semibold transition hover:text-gold-deep">
                      {l.phone}
                    </a>
                  </div>

                  <div className="flex items-start gap-3 text-sm">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
                    <ul className="ivory-muted space-y-1">
                      {l.hours.map((h) => (
                        <li key={h.day} className="flex gap-3">
                          <span className="w-24 shrink-0">{h.day}</span>
                          <span>{h.time}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <a href={l.phoneHref} className="btn-gold-solid flex-1 gap-2">
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(l.mapQuery)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-outline-ink flex-1 gap-2"
                    >
                      <Navigation className="h-3.5 w-3.5" /> Directions
                    </a>
                  </div>

                  <Link to="/book" search={{ location: l.name }} className="btn-silver mt-1 w-full gap-2">
                    <CalendarCheck className="h-4 w-4" /> Book at {l.name}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simple contact strip */}
      <section className="bg-ink py-16 md:py-20">
        <div className="container-x">
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="eyebrow">Prefer to write?</div>
            <a
              href={`mailto:${BUSINESS.email}`}
              className="group flex items-center gap-4 text-white transition hover:text-gold"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold transition group-hover:scale-105">
                <Mail className="h-4 w-4" />
              </span>
              <span className="font-display text-xl">{BUSINESS.email}</span>
            </a>
            <p className="max-w-xl text-sm leading-7 text-white/80">
              We answer emails within one business day. For same-day availability, call the shop directly,
              members always get first pick of the chair.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
