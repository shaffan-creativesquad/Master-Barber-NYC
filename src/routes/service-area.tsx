import { breadcrumbSchema, faqSchema } from "@/lib/seo-schema";
import { createFileRoute } from "@tanstack/react-router";
import { CTAFooter } from "@/components/site/CTAFooter";
import { RelatedLinks } from "@/components/site/RelatedLinks";
import { ServicesShowcase } from "@/components/site/ServicesShowcase";
import { FAQSection, SectionHeader, ServiceAreaSection, TestimonialsSection } from "@/components/site/Sections";
import { BUSINESS, NEIGHBORHOODS } from "@/lib/site-data";

export const Route = createFileRoute("/service-area")({
  head: () => ({
    meta: [
      { title: "Brooklyn Service Area | Master Barber NYC" },
      {
        name: "description",
        content:
          "Two Brooklyn shops, Park Slope on 7th Ave and Downtown on Bond St. Serving Park Slope, Boerum Hill, Fort Greene, Cobble Hill and neighbors across Brooklyn.",
      },
      { property: "og:title", content: "Service Area | Master Barber NYC" },
      {
        property: "og:description",
        content: "Brooklyn's high-end barbershop in Park Slope and Downtown. See the neighborhoods we serve.",
      },
      { property: "og:url", content: "https://masterbarbernyc.com/service-area" },
      { property: "og:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { name: "twitter:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/service-area" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(faqSchema()) },
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Service Area", path: "/service-area" }])) },
    ],
  }),
  component: ServiceAreaPage,
});

function ServiceAreaPage() {
  return (
    <>
      <section className="bg-ink text-cream">
        <div className="container-x py-24 md:py-32">
          <div className="eyebrow">Where to Find Us</div>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] md:text-7xl">
            A Brooklyn chair. Not a chain address.
          </h1>
          <div className="hairline mt-8 max-w-40" />
          <p className="mt-8 max-w-xl text-lg text-cream/75">
            Our flagship shop sits on {BUSINESS.address.line1}, walking
            distance from the 7th Ave and Atlantic Ave–Barclays Center stops.
            Members come from every corner of Brooklyn, here are the ones
            we see the most.
          </p>
        </div>
      </section>

      <section className="container-x py-20 md:py-28">
        <ServiceAreaSection />
      </section>

      <section className="bg-secondary/50 py-20 md:py-28">
        <div className="container-x">
          <SectionHeader
            eyebrow="Neighbors We See Weekly"
            title="Rooted in the community."
            sub="Whether you're two blocks away or a G-train ride out, we save you a chair."
          />
          <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {NEIGHBORHOODS.map((n) => (
              <li
                key={n}
                className="rounded-sm border border-border bg-card px-5 py-4 text-sm text-foreground"
              >
                {n}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-x py-20 md:py-28">
        <SectionHeader eyebrow="Services" title="Full menu, same chair." />
        <div className="mt-12">
          <ServicesShowcase variant="carousel" />
        </div>
      </section>

      <section className="bg-secondary/50 py-20 md:py-28">
        <div className="container-x">
          <SectionHeader eyebrow="FAQ" title="Getting here." />
          <div className="mt-8">
            <FAQSection />
          </div>
        </div>
      </section>

      <section className="container-x py-20 md:py-28">
        <SectionHeader eyebrow="Voices from the Block" title="What Brooklyn says." />
        <div className="mt-12">
          <TestimonialsSection />
        </div>
      </section>

      <RelatedLinks
        title="Related pages"
        items={[
          { to: "/services", label: "Service Menu", description: "Haircuts, hot towel shaves and beard work at both Brooklyn shops." },
          { to: "/pricing", label: "Pricing", description: "Transparent prices for every service on the menu." },
          { to: "/contact", label: "Contact and Directions", description: "Maps, phone numbers and hours for Park Slope and Downtown." },
        ]}
      />

      <CTAFooter
        heading="Save a Chair in Brooklyn."
        sub="Same-day chairs open up all week. Reserve online or ring the shop."
      />
    </>
  );
}
