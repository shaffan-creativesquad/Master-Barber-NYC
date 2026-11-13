import { breadcrumbSchema } from "@/lib/seo-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { SectionHeader } from "@/components/site/Sections";
import { CTAFooter } from "@/components/site/CTAFooter";
import { WhyChooseUs } from "@/components/site/WhyChooseUs";
import { SITE_IMAGES } from "@/lib/site-images";
import { LOCATIONS } from "@/lib/site-data";
import { MapPin, Phone } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us | Brooklyn Barbershop | Master Barber NYC" },
      {
        name: "description",
        content:
          "Isaac's owner-operated Brooklyn barbershop: precision cuts, straight-razor shaves and unhurried craft across two locations, open six days a week.",
      },
      { property: "og:title", content: "About Master Barber NYC" },
      { property: "og:description", content: "Owner-operated. 180+ members. Two Brooklyn locations. A cut above the rest." },
      { property: "og:url", content: "https://masterbarbernyc.com/about" },
      { property: "og:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { name: "twitter:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/about" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "About", path: "/about" }])) },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="The House"
        title={<>A Brooklyn chair, <span className="two-tone-accent">refined</span>.</>}
        intro="Master Barber NYC is owner-operated in Brooklyn, a room built on precision technique, calm energy, and the kind of service that never feels transactional."
        image={SITE_IMAGES.about}
      />

      {/* Merged editorial section, Standard + Every Product Tested + Key Benefits */}
      <section className="section-bg py-24 md:py-32">
        <div
          className="section-bg-image-20"
          style={{ backgroundImage: `url(${SITE_IMAGES.beard})` }}
        />
        <div className="section-bg-fade-btt" />
        <div className="container-x">
          {/* The Standard */}
          <div className="grid gap-14 md:grid-cols-12 md:gap-16">
            <div className="md:col-span-7">
              <div className="eyebrow">The Standard</div>
              <h2 className="mt-5 font-display text-4xl leading-[1.05] text-cream md:text-6xl lg:text-7xl">
                Every barber on the floor keeps pace with the <span className="two-tone-accent">craft</span>.
              </h2>
            </div>
            <div className="md:col-span-5 md:pt-6">
              <p className="max-w-md text-base leading-8 text-cream/72 md:text-lg">
                From modern low-taper fades and textured crops seen on screen to
                the timeless side part your grandfather wore, every barber
                behind our chairs stays current on trends and grounded in
                classic technique.
              </p>
              <div className="hairline mt-8 max-w-24" />
              <p className="mt-8 max-w-md text-sm leading-7 text-cream/55">
                Bring in a reference, describe the finish you want, or ask us to
                choose. Whatever the direction, the work is done at the same
                deliberate pace and finished the same clean way.
              </p>
            </div>
          </div>

          {/* Every Product Tested */}
          <div className="mt-24 grid gap-10 md:mt-32 md:grid-cols-12 md:gap-14">
            <figure className="relative md:col-span-7">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={SITE_IMAGES.services}
                  alt="Barber cutting hair with scissors at Master Barber NYC in Brooklyn"
                  loading="lazy"
                  decoding="async"
                  width={1200}
                  height={900}
                  className="h-full w-full object-cover transition duration-700 hover:scale-[1.02]"
                />
              </div>
              <figcaption className="mt-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-cream/45">
                <span className="h-px w-8 bg-gold/60" />
                Scissor Detail, Park Slope
              </figcaption>
            </figure>
            <div className="md:col-span-5 md:pt-4">
              <div className="eyebrow">Every Product Tested</div>
              <h3 className="mt-5 font-display text-3xl leading-tight text-cream md:text-4xl">
                From <span className="two-tone-accent">aftershave</span> to hair gel, approved by the team.
              </h3>
              <p className="mt-6 text-base leading-8 text-cream/72">
                Before we ever finish a client with a product, we run it through
                the room ourselves, pomades, clays, oils, tonics, aftershaves.
                If it doesn't hold up to a full week on our own hair, it never
                touches the counter.
              </p>
              <div className="hairline mt-8 max-w-24" />
              <p className="mt-8 text-sm leading-7 text-cream/55">
                Ask us for a product recommendation at the chair. What we
                suggest is what we actually use.
              </p>
            </div>
          </div>

          {/* Key Benefits (Why Master Barber) */}
          <div className="mt-24 md:mt-32">
            <WhyChooseUs />
          </div>
        </div>
      </section>

      {/* Editorial numbers */}
      <section className="bg-ink py-20 md:py-24">
        <div className="container-x">
          <div className="grid gap-10 md:grid-cols-4">
            <NumberStat n="180+" label="Active Members" />
            <NumberStat n="02" label="Brooklyn Locations" />
            <NumberStat n="06" label="Days a Week" />
            <NumberStat n="05+" label="Years in Brooklyn" />
          </div>
        </div>
      </section>


      {/* Locations */}
      <section className="bg-ink py-20 md:py-28">
        <div className="container-x">
          <SectionHeader
            align="center"
            eyebrow="Find the Room"
            title={<>Two <span className="two-tone-accent">Brooklyn</span> locations.</>}
            sub="Both owner-operated. Both open six days a week. Whichever chair you pick, it's the same standard."
          />
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-2">
            {LOCATIONS.map((l) => (
              <article key={l.name} className="group border border-white/10 bg-charcoal/60 p-8 transition duration-500 hover:-translate-y-1 hover:border-gold/50 hover:bg-charcoal/85 md:p-10">
                <div className="flex items-center gap-3 text-cream">
                  <MapPin className="h-4 w-4 text-gold transition group-hover:scale-110" />
                  <div className="font-display text-2xl">{l.name}</div>
                </div>
                <div className="mt-3 text-sm text-white">{l.address}</div>
                <a href={l.phoneHref} className="mt-2 inline-flex items-center gap-2 text-sm text-white transition hover:text-gold">
                  <Phone className="h-3.5 w-3.5 text-gold" /> {l.phone}
                </a>
                <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />
                <ul className="mt-6 space-y-2 text-[13px] text-white">
                  {l.hours.map((h) => (
                    <li key={h.day} className="flex justify-between">
                      <span className="text-white/70">{h.day}</span>
                      <span>{h.time}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/book" search={{ location: l.name }} className="btn-ghost mt-8 w-full">Book This Chair</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CTAFooter heading="Reserve your chair." />
    </>
  );
}

function NumberStat({ n, label }: { n: string; label: string }) {
  return (
    <div className="border-t border-white/10 pt-5">
      <div className="font-display text-5xl gold-text md:text-6xl">{n}</div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-cream/50">{label}</div>
    </div>
  );
}
