import { membershipFromPrice } from "@/lib/site-data";
import { breadcrumbSchema, faqSchema, serviceCatalogSchema } from "@/lib/seo-schema";
import { createFileRoute } from "@tanstack/react-router";
import { CTAFooter } from "@/components/site/CTAFooter";
import { RelatedLinks } from "@/components/site/RelatedLinks";
import { ServicesShowcase } from "@/components/site/ServicesShowcase";
import { MembershipSection } from "@/components/site/MembershipSection";
import { FAQSection, ProcessSection, SectionHeader, TestimonialsSection } from "@/components/site/Sections";
import { SITE_IMAGES } from "@/lib/site-images";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services & Pricing | Master Barber NYC" },
      {
        name: "description",
        content:
          "Signature haircuts from $35, hot towel shaves, beard work, and a $49/month unlimited membership at Brooklyn's Master Barber NYC.",
      },
      { property: "og:title", content: "Services & Pricing | Master Barber NYC" },
      {
        property: "og:description",
        content: "Every service on the menu with real prices, no upsells at the chair.",
      },
      { property: "og:url", content: "https://masterbarbernyc.com/services" },
      { property: "og:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { name: "twitter:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/services" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(faqSchema()) },
      { type: "application/ld+json", children: JSON.stringify(serviceCatalogSchema()) },
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Services", path: "/services" }])) },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-cream">
        <img
          src={SITE_IMAGES.services}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          width={1920}
          height={1280}
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/55 to-ink" />
        <div className="container-x py-24 md:py-32">
          <div className="eyebrow">The Menu</div>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] md:text-7xl">
            Every service. Every price. Nothing hidden.
          </h1>
          <div className="hairline mt-8 max-w-40" />
          <p className="mt-8 max-w-xl text-lg text-cream/75">
            We publish real prices so you walk in knowing exactly what you'll
            pay. Members skip the price talk entirely, one flat rate,
            unlimited cuts.
          </p>
        </div>
      </section>

      <section className="container-x py-20 md:py-28">
        <SectionHeader eyebrow="Full Menu" title="Priced by the chair. Not the neighborhood." />
        <div className="mt-12">
          <ServicesShowcase variant="grouped" />
        </div>
        <div className="mt-20">
          <SectionHeader align="center" eyebrow="Membership" title="Unlimited cuts, one rate." />
          <div className="mt-12">
            <MembershipSection />
          </div>
        </div>
      </section>

      <section className="bg-secondary/50 py-20 md:py-28">
        <div className="container-x">
          <SectionHeader eyebrow="Your Visit" title="A calm, deliberate process." />
          <div className="mt-14">
            <ProcessSection variant="cards" />
          </div>
        </div>
      </section>

      <section className="container-x py-20 md:py-28">
        <SectionHeader eyebrow="FAQ" title="Common questions about the chair." />
        <div className="mt-8">
          <FAQSection />
        </div>
      </section>

      <section className="bg-secondary/50 py-20 md:py-28">
        <div className="container-x">
          <SectionHeader eyebrow="What Regulars Say" title="Word travels down 7th Ave." />
          <div className="mt-12">
            <TestimonialsSection />
          </div>
        </div>
      </section>

      <RelatedLinks
        title="Related pages"
        items={[
          { to: "/pricing", label: "Full Price List", description: "Every haircut, shave and add-on with the price printed next to it." },
          { to: "/members-club", label: "Members Club", description: `Unlimited cuts from ${membershipFromPrice()} a month at both Brooklyn shops.` },
          { to: "/service-area", label: "Brooklyn Service Area", description: "Park Slope, Downtown Brooklyn and the neighborhoods we serve." },
        ]}
      />

      <CTAFooter
        heading="Pick Your Service. Pick Your Chair."
        sub="Reserve online in under a minute. We'll text a confirmation and see you in Brooklyn."
      />
    </>
  );
}
