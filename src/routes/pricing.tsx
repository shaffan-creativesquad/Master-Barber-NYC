import { breadcrumbSchema, serviceCatalogSchema } from "@/lib/seo-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { ServicesShowcase } from "@/components/site/ServicesShowcase";
import { SectionHeader } from "@/components/site/Sections";
import { CTAFooter } from "@/components/site/CTAFooter";
import { RelatedLinks } from "@/components/site/RelatedLinks";
import { SITE_IMAGES } from "@/lib/site-images";
import { HAIRCUT_SERVICES, RAZOR_SERVICES, membershipFromPrice } from "@/lib/site-data";
import { Scissors, Sparkles, ShieldCheck, Clock3 } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Brooklyn Barbershop Prices | Haircut & Shave Menu | Master Barber NYC" },
      {
        name: "description",
        content:
          `See Master Barber NYC's full Brooklyn barbershop prices. Haircut and shave menu for our Park Slope and Downtown Brooklyn locations, plus unlimited memberships from ${membershipFromPrice()}/month.`,
      },
      { property: "og:title", content: "Brooklyn Barbershop Prices | Haircut & Shave Menu | Master Barber NYC" },
      { property: "og:description", content: "Real prices, no upsells. Haircut and shave menu at our Park Slope and Downtown Brooklyn barbershops." },
      { property: "og:url", content: "https://masterbarbernyc.com/pricing" },
      { property: "og:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { name: "twitter:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/pricing" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(serviceCatalogSchema()) },
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Pricing", path: "/pricing" }])) },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="The Menu"
        title={<>Brooklyn barbershop prices, <span className="two-tone-accent">no upsells</span>.</>}
        intro="Every haircut, every razor service, every add-on, priced in full and printed on the wall. Serving Park Slope and Downtown Brooklyn with the same honest menu at both locations."
        image={SITE_IMAGES.services}
      />

      {/* Value strip */}
      <section className="border-b border-white/8 bg-ink">
        <div className="container-x grid grid-cols-1 divide-white/8 py-10 text-center sm:grid-cols-3 sm:divide-x">
          <ValueStat icon={<ShieldCheck className="h-4 w-4" />} label="Menu Prices" value="What you see is what you pay" />
          <ValueStat icon={<Clock3 className="h-4 w-4" />} label="Honest Timing" value="20 – 75 min per service" />
          <ValueStat icon={<Sparkles className="h-4 w-4" />} label="Members" value={`Unlimited cuts from ${membershipFromPrice()}/mo`} />
        </div>
      </section>

      {/* Haircut services */}
      <section className="section-bg py-24 md:py-28">
        <div
          className="section-bg-image-faint"
          style={{ backgroundImage: `url(${SITE_IMAGES.services})` }}
        />
        <div className="section-bg-fade" />
        <div className="container-x">
          <SectionHeader
            align="center"
            eyebrow="The Chair"
            title={<>Haircut <span className="two-tone-accent">services</span>.</>}
            sub="Classic and modern work, clipper, scissor, fade, long-hair detail. All finished with a warm neck shave and product placement."
          />
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {HAIRCUT_SERVICES.map((s) => (
              <PriceCard key={s.name} name={s.name} price={s.price} duration={s.duration} description={s.description} popular={s.popular} icon={<Scissors className="h-4 w-4" />} />
            ))}
          </div>
        </div>
      </section>

      {/* Razor services */}
      <section className="section-bg py-24 md:py-28">
        <div
          className="section-bg-image-faint"
          style={{ backgroundImage: `url(${SITE_IMAGES.shave})` }}
        />
        <div className="section-bg-fade" />
        <div className="container-x">
          <SectionHeader
            align="center"
            eyebrow="The Ritual"
            title={<>Razor <span className="two-tone-accent">services</span>.</>}
            sub="Hot lather, hot towels, cold finish. Every razor service is done by a licensed barber with a straight edge and unhurried hands."
          />
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-2">
            {RAZOR_SERVICES.map((s) => (
              <PriceCard key={s.name} name={s.name} price={s.price} duration={s.duration} description={s.description} popular={s.popular} icon={<Sparkles className="h-4 w-4" />} />
            ))}
          </div>
        </div>
      </section>

      {/* Membership teaser, full width, no background image */}
      <section className="bg-ink py-24 md:py-28">
        <div className="container-x">
          <div className="mx-auto max-w-5xl text-center">
            <div className="eyebrow">The Better Way</div>
            <h2 className="mt-6 font-display text-5xl leading-[1.02] text-cream md:text-6xl lg:text-7xl">
              Skip pricing entirely. <span className="two-tone-accent">Go unlimited.</span>
            </h2>
            <div className="rule-gold mx-auto mt-8 block" />
            <p className="mx-auto mt-8 max-w-2xl text-base leading-8 text-cream/70 md:text-lg">
              Most regulars break even on their membership in two visits. Cuts, beard work and shaves on tap, one flat monthly rate, at both Brooklyn locations.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/members-club" className="btn-gold">See Membership</Link>
              <Link to="/contact" className="btn-ghost">Book a Chair</Link>
            </div>
          </div>
        </div>
      </section>


      <div className="mt-0">
        <RelatedLinks
          title="Related pages"
          items={[
            { to: "/services", label: "Service Menu", description: "What each haircut, shave and beard service actually includes." },
            { to: "/members-club", label: "Members Club", description: "Three tiers of unlimited grooming, cancel any time." },
            { to: "/book", label: "Book an Appointment", description: "Pick your shop, service, barber and time in under a minute." },
          ]}
        />

        <CTAFooter />
      </div>
    </>
  );
}

function ValueStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-4">
      <span className="grid h-9 w-9 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
        {icon}
      </span>
      <div className="text-[10px] uppercase tracking-[0.28em] text-cream/50">{label}</div>
      <div className="text-sm text-cream/85">{value}</div>
    </div>
  );
}

function PriceCard({
  name,
  price,
  duration,
  description,
  popular,
  icon,
}: {
  name: string;
  price: string;
  duration?: string;
  description?: string;
  popular?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <article className="group relative flex flex-col border border-white/8 bg-charcoal/60 p-6 transition duration-500 hover:-translate-y-1 hover:border-gold/50 hover:bg-charcoal/85 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold transition group-hover:scale-105">
            {icon}
          </span>
          <h3 className="font-display text-xl leading-tight text-cream md:text-2xl">{name}</h3>
        </div>
        <div className="font-numeric text-3xl font-semibold gold-text">{price}</div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.24em] text-cream/45">
        {duration && <span>{duration}</span>}
        {popular && (
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-gold">Guest favorite</span>
        )}
      </div>
      {description && <p className="mt-4 text-sm leading-7 text-cream/60">{description}</p>}
      <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <Link to="/book" search={{ service: name }} className="mt-5 inline-flex text-[11px] font-semibold uppercase tracking-[0.28em] text-cream/70 transition hover:text-gold">
        Book this service →
      </Link>
    </article>
  );
}

// Silence unused-import when variant unused
export const _touch = ServicesShowcase;
