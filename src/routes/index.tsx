import { useState } from "react";
import { faqSchema } from "@/lib/seo-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BUSINESS, membershipFromPrice } from "@/lib/site-data";
import { SITE_IMAGES } from "@/lib/site-images";
import { GALLERY_IMAGES } from "@/lib/gallery-images";
import { Scissors, MapPin, Crown, Sparkles, Award, ShieldCheck } from "lucide-react";

import { ServicesShowcase } from "@/components/site/ServicesShowcase";
import { LocationsSection } from "@/components/site/LocationsSection";
import { CTAFooter } from "@/components/site/CTAFooter";
import { Lightbox } from "@/components/site/Lightbox";

import { MembershipSection } from "@/components/site/MembershipSection";
import {
  FAQSection,
  SectionHeader,
  TestimonialsSection,
} from "@/components/site/Sections";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Master Barber NYC | Brooklyn's Premium Barbershop" },
      {
        name: "description",
        content:
          `Master Barber NYC, Brooklyn's high-end barbershop with two locations. Precision cuts, hot towel shaves and unlimited-cut memberships from ${membershipFromPrice()}/month.`,
      },
      { property: "og:title", content: "Master Barber NYC | Brooklyn's Premium Barbershop" },
      {
        property: "og:description",
        content:
          `Master Barber NYC, Brooklyn's high-end barbershop with two locations. Precision cuts, hot towel shaves and unlimited-cut memberships from ${membershipFromPrice()}/month.`,
      },
      { property: "og:url", content: "https://masterbarbernyc.com/" },
      { property: "og:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { name: "twitter:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
    ],
    links: [
      { rel: "canonical", href: "https://masterbarbernyc.com/" },
      { rel: "preload", as: "image", href: SITE_IMAGES.about, fetchPriority: "high" },
    ],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(faqSchema()) },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <Hero />

      <section
        id="services-pricing"
        className="section-bg scroll-mt-28 py-24 md:py-32"
      >
        <div
          className="section-bg-image"
          style={{ backgroundImage: `url(${SITE_IMAGES.services})` }}
        />
        <div className="section-bg-fade" />
        <div className="container-x">
          <SectionHeader
            align="center"
            eyebrow="Services & Pricing"
            title={<>The full <span className="two-tone-accent">menu</span>.</>}
            sub="Transparent prices. Honest timing. Members enjoy unlimited signature haircuts from a flat monthly rate."
          />
          <div className="mt-14">
            <ServicesShowcase variant="grouped" />
          </div>
        </div>
      </section>

      <section id="locations" className="scroll-mt-28 bg-ink py-24 md:py-32">
        <div className="container-x">
          <SectionHeader
            align="center"
            eyebrow="Choose Your Location"
            title={<>Select the shop that's <span className="two-tone-accent">closest to you</span>.</>}
            sub="Two Brooklyn rooms, same standard. Pick whichever is most convenient, call the shop directly or get directions."
          />
          <div className="mt-14">
            <LocationsSection />
          </div>
        </div>
      </section>

      <section
        id="membership"
        className="section-bg scroll-mt-28 py-24 md:py-32"
      >
        <div
          className="section-bg-image-soft"
          style={{ backgroundImage: `url(${SITE_IMAGES.shave})` }}
        />
        <div className="section-bg-fade-center" />
        <div className="container-x relative">
          <SectionHeader
            align="center"
            eyebrow="The Members Club"
            title={<>Unlimited grooming. <span className="two-tone-accent">One flat rate.</span></>}
            sub="Three tiers. One promise: walk in, get sharp, walk out. Cancel any time."
          />
          <div className="mt-14">
            <MembershipSection />
          </div>
        </div>
      </section>

      <About />

      <GallerySection />

      <section className="section-bg py-24 md:py-32">
        <div
          className="section-bg-image-soft"
          style={{ backgroundImage: `url(${SITE_IMAGES.fade})` }}
        />
        <div className="section-bg-fade" />
        <div className="container-x">
          <SectionHeader
            align="center"
            eyebrow="Guest Book"
            title={<>Kind words from <span className="two-tone-accent">the chair</span>.</>}
          />
          <div className="mt-14">
            <TestimonialsSection />
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="section-bg scroll-mt-28 py-24 md:py-28"
      >
        <div
          className="section-bg-image-faint"
          style={{ backgroundImage: `url(${SITE_IMAGES.about})` }}
        />
        <div className="section-bg-fade" />
        <div className="container-x">
          <SectionHeader
            align="center"
            eyebrow="FAQ"
            title={<>Answers before <span className="two-tone-accent">you book</span>.</>}
            sub="Everything regulars usually ask before their first visit, membership upgrade, or shave service."
          />
          <div className="mt-12">
            <FAQSection />
          </div>
        </div>
      </section>


      <CTAFooter />

    </>
  );
}


function Hero() {
  return (
    <section className="relative isolate flex min-h-screen items-end justify-center overflow-hidden bg-ink pt-20 text-cream">
      <img
        src={SITE_IMAGES.about}
        alt="Barber chairs and interior at Master Barber NYC in Brooklyn"
        fetchPriority="high"
        decoding="async"
        width={1920}
        height={1280}
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,8,10,0.35)_0%,rgba(8,8,10,0.5)_45%,rgba(8,8,10,0.82)_80%,rgba(8,8,10,0.95)_100%)]" />
      <div className="container-x flex w-full items-end justify-center pb-20 text-center md:pb-28 lg:pb-32">
        <div className="max-w-5xl">
          <h1 className="font-display text-5xl leading-[1.05] text-cream md:text-6xl lg:text-[5.25rem]">
            Brooklyn Grooming
            <br />
            <span className="two-tone-accent">Sharper Standard</span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-base leading-8 text-cream/82 md:text-lg">
            Precision haircuts, straight-razor shaves, and memberships built for
            men who like their barbershop to feel as considered as the result.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a href={BUSINESS.bookingUrl} className="btn-gold">
              Book an Appointment
            </a>
            <Link to="/pricing" className="btn-ghost">
              View Pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

const KEY_BENEFITS = [
  { icon: Scissors, title: "Master-Level Craft", body: "Classic technique. Modern fades. No rotating chairs." },
  { icon: MapPin, title: "Two Brooklyn Rooms", body: "Park Slope and Downtown Brooklyn, six days a week." },
  { icon: Crown, title: "Membership Worth It", get body() { return `Unlimited cuts from ${membershipFromPrice()}. Break even in two visits.`; } },
  { icon: Sparkles, title: "Upscale, Unhurried", body: "Leather, brass, low lighting | private-club energy." },
  { icon: Award, title: "Precision Every Time", body: "Your part, your fade, your finish | remembered." },
  { icon: ShieldCheck, title: "Honest Pricing", body: "Menu prices are what you pay. No upsell games." },
];

function About() {
  return (
    <section id="about-house" className="scroll-mt-28 relative overflow-hidden bg-ink py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background:radial-gradient(60%_50%_at_10%_0%,var(--color-gold),transparent_65%)]" />
      <div className="container-x relative">
        <div className="grid gap-14 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-7">
            <div className="eyebrow">The House</div>
            <h2 className="mt-5 font-display text-4xl leading-[1.02] text-cream md:text-6xl lg:text-[4.5rem]">
              A Cut <span className="two-tone-accent">Refined</span>
            </h2>
            <div className="mt-8 space-y-6 max-w-xl">
              <p className="text-base leading-8 text-cream/72 md:text-lg">
                Isaac opened Master Barber NYC because Brooklyn deserved a chair
                that felt more refined than rushed, precision work, calm energy,
                service that never feels transactional.
              </p>
              <p className="text-base leading-8 text-cream/72 md:text-lg">
                Two owner-operated locations. 180+ active members. A room built
                on warm lighting, deliberate pace, and barbers who remember how
                you like to leave the chair.
              </p>
            </div>

            {/* Key benefits, no heading, appears naturally beneath the copy */}
            <div className="mt-12 max-w-xl">
              <ul className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
                {KEY_BENEFITS.map((b) => (
                  <li
                    key={b.title}
                    className="group flex items-start gap-4 transition-transform duration-500 hover:-translate-y-0.5"
                  >
                    <span className="icon-tile mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center border border-gold/40 bg-gold/10 text-gold transition-all duration-500 group-hover:border-gold group-hover:bg-gold/20 group-hover:text-gold-soft group-hover:shadow-[0_0_22px_-4px_var(--color-gold)]">
                      <b.icon className="h-4 w-4 transition-transform duration-500 group-hover:scale-110" strokeWidth={1.5} />
                    </span>
                    <div>
                      <div className="font-display text-lg leading-tight text-cream transition-colors duration-500 group-hover:text-gold-soft">{b.title}</div>
                      <p className="mt-1 text-[13px] leading-6 text-cream/62">{b.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/pricing" className="btn-gold">
                See the Full Menu
              </Link>
            </div>
          </div>

          <div className="md:col-span-5">
            <figure className="relative group overflow-hidden rounded-sm">
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
                <img
                  src={SITE_IMAGES.about}
                  alt="Barber chair and interior at the Master Barber NYC shop in Brooklyn"
                  loading="lazy"
                  decoding="async"
                  width={800}
                  height={1000}
                  className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.03]"
                />
              </div>
            </figure>

            <div className="mt-8 grid grid-cols-3 gap-6">
              <Stat number="180+" label="Members" />
              <Stat number="02" label="Locations" />
              <Stat number="06" label="Days" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}



function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="group border-t border-white/10 pt-4 transition-all duration-500 hover:border-gold/60">
      <div className="font-numeric text-5xl font-semibold gold-text transition-transform duration-500 group-hover:-translate-y-0.5 md:text-6xl">{number}</div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-cream/50 transition-colors group-hover:text-gold-soft">
        {label}
      </div>
    </div>
  );
}


function GallerySection() {
  // Six curated images from the full gallery, balanced spread across the set
  const PICKS = [0, 3, 6, 8, 11, 14];
  const images = PICKS.map((i) => GALLERY_IMAGES[i] ?? GALLERY_IMAGES[i % GALLERY_IMAGES.length]);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="relative bg-ink py-24 text-cream md:py-32">
      <div className="container-wide relative">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="eyebrow">The Portfolio</div>
              <h2 className="mt-4 font-display text-5xl leading-[1.02] text-cream md:text-6xl lg:text-7xl">
                Detail work worth <span className="two-tone-accent">a closer look</span>.
              </h2>
            </div>
            <Link to="/gallery" className="btn-ghost">
              Full Gallery
            </Link>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open image ${i + 1} in lightbox`}
              className="group relative aspect-square overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <img
                src={src}
                alt={`Fade, haircut and shave work from Master Barber NYC Brooklyn, example ${i + 1}`}
                loading="lazy"
                decoding="async"
                width={600}
                height={600}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/25" />
            </button>
          ))}
        </div>
      </div>

      {open !== null && (
        <Lightbox
          images={images}
          index={open}
          onIndexChange={setOpen}
          onClose={() => setOpen(null)}
          alt="Master Barber NYC portfolio"
        />
      )}
    </section>
  );
}

