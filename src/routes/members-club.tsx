import { breadcrumbSchema } from "@/lib/seo-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { MembershipSection } from "@/components/site/MembershipSection";
import { CTAFooter } from "@/components/site/CTAFooter";
import { SectionHeader } from "@/components/site/Sections";
import { SITE_IMAGES } from "@/lib/site-images";
import { getMemberships, membershipFromPrice, type Membership } from "@/lib/site-data";
import { Check, Minus, Crown, Infinity as InfinityIcon, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/members-club")({
  head: () => ({
    meta: [
      { title: "Members Club: Unlimited Cuts | Master Barber NYC" },
      {
        name: "description",
        content:
          "Three membership tiers, Bronze, Silver and Gold. Unlimited haircuts, beard work and hot towel shaves at both Brooklyn locations. Cancel any time.",
      },
      { property: "og:title", content: "Members Club | Master Barber NYC" },
      { property: "og:description", content: "180+ members. One flat monthly rate. Priority booking at every Master Barber chair in Brooklyn." },
      { property: "og:url", content: "https://masterbarbernyc.com/members-club" },
      { property: "og:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { name: "twitter:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/members-club" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Members Club", path: "/members-club" }])) },
    ],
  }),
  component: MembersClubPage,
});

function MembersClubPage() {
  return (
    <>
      <PageHero
        eyebrow="The Members Club"
        title={<>Unlimited grooming. <span className="two-tone-accent">One flat rate.</span></>}
        intro="Three tiers. 180+ members. Walk in sharp, walk out sharper at both Brooklyn locations."
        image={SITE_IMAGES.about}
      />

      {/* Overview stats */}
      <section className="border-b border-white/8 bg-ink">
        <div className="container-x grid grid-cols-2 divide-white/8 py-10 text-center md:grid-cols-4 md:divide-x">
          <OverviewStat n="180+" label="Active Members" />
          <OverviewStat n={membershipFromPrice()} label="Starts At / Month" />
          <OverviewStat n="02" label="Brooklyn Locations" />
          <OverviewStat n="06" label="Days a Week" />
        </div>
      </section>

      {/* Tiers */}
      <section className="section-bg py-24 md:py-28">
        <div className="section-bg-image-soft" style={{ backgroundImage: `url(${SITE_IMAGES.shave})` }} />
        <div className="section-bg-fade-center" />
        <div className="container-x">
          <SectionHeader
            align="center"
            eyebrow="Choose Your Tier"
            title={<>Three levels of <span className="two-tone-accent">unlimited</span>.</>}
            sub="Bronze covers unlimited signature cuts. Silver adds beard work. Gold adds the full hot towel ritual."
          />
          <div className="mt-14">
            <MembershipSection />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-ink py-24 md:py-28">
        <div className="container-x">

          <SectionHeader
            align="center"
            eyebrow="Why Members Stay"
            title={<>The <span className="two-tone-accent">everyday</span> benefits.</>}
          />
          <div className="mx-auto mt-14 grid max-w-5xl gap-x-12 gap-y-12 md:grid-cols-3">
            <Benefit icon={<InfinityIcon className="h-5 w-5" />} title="Truly unlimited" body="Walk in for a line-up on Tuesday and a full cut on Friday, no per-visit charge, no fine print." />
            <Benefit icon={<Crown className="h-5 w-5" />} title="Priority access" body="Members-only slots at both locations. First pick before public availability opens each week." />
            <Benefit icon={<Sparkles className="h-5 w-5" />} title="Guest privileges" body="Bring a friend into the chair on select dates, members unlock invites to shop events and product launches." />
            <Benefit icon={<Users className="h-5 w-5" />} title="Same chair, same barber" body="We remember your fade, your part, your pace. Consistency across every visit." />
            <Benefit icon={<Check className="h-5 w-5" />} title="No contracts" body="Month-to-month, cancel anytime. Pause when you're traveling, we'll be here when you're back." />
            <Benefit icon={<Sparkles className="h-5 w-5" />} title="Guest favorites" body="Members unlock hot towel shaves, head shaves and beard rituals on the Gold tier, on tap." />
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="section-bg py-24 md:py-28">
        <div className="section-bg-image-faint" style={{ backgroundImage: `url(${SITE_IMAGES.beard})` }} />
        <div className="section-bg-fade" />
        <div className="container-x">
          <SectionHeader
            align="center"
            eyebrow="Compare"
            title={<>Tier by <span className="two-tone-accent">tier</span>.</>}
          />
          <div className="mx-auto mt-14 max-w-4xl overflow-hidden border border-white/8">
            <div className="grid grid-cols-4 items-center border-b border-white/8 bg-charcoal/70 px-6 py-5 text-[10px] uppercase tracking-[0.24em] text-cream/55 md:px-8">
              <div>Benefit</div>
              <div className="text-center text-gold">Bronze</div>
              <div className="text-center">Silver</div>
              <div className="text-center">Gold</div>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.label}
                className={
                  "grid grid-cols-4 items-center px-6 py-5 text-sm md:px-8 " +
                  (i % 2 === 0 ? "bg-charcoal/30" : "bg-charcoal/50")
                }
              >
                <div className="pr-3 text-cream/85">{row.label}</div>
                <Cell v={row.bronze} />
                <Cell v={row.silver} />
                <Cell v={row.gold} />
              </div>
            ))}
            <div className="grid grid-cols-4 items-center border-t border-white/8 bg-charcoal/85 px-6 py-6 text-sm md:px-8">
              <div className="text-[10px] uppercase tracking-[0.24em] text-cream/55">Monthly</div>
              {["bronze-annual", "silver-monthly", "gold-monthly"].map((id) => {
                const m = getMemberships().find((p) => p.id === id)!;
                return (
                  <div key={m.id} className="text-center font-numeric text-2xl font-semibold gold-text">
                    ${(m.amountCents / 100).toFixed(m.amountCents % 100 === 0 ? 0 : 2)}
                    <span className="ml-1 text-xs font-normal uppercase tracking-widest text-cream/50">/mo</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-ink pb-4 pt-4">
        <div className="container-x">
          <div className="flex flex-col items-center gap-6 border border-white/10 bg-charcoal/60 p-10 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <div className="eyebrow">Ready to join?</div>
              <h3 className="mt-3 font-display text-3xl text-cream md:text-4xl">
                Join today, we'll scan your card in the chair.
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/members-checkout" search={{ plan: "bronze-annual" }} className="btn-gold">Join Now</Link>
              <Link to="/pricing" className="btn-ghost">See Full Menu</Link>
            </div>
          </div>
        </div>
      </section>

      <CTAFooter heading="Join the club." sub="Sign up in under a minute, then visit either Brooklyn location and have your member card scanned at the front desk." />
    </>
  );
}

function OverviewStat({ n, label }: { n: string; label: string }) {
  return (
    <div className="px-3 py-3">
      <div className="font-display text-4xl md:text-5xl gold-text">{n}</div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-cream/50">{label}</div>
    </div>
  );
}

function Benefit({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group">
      <span className="inline-grid h-11 w-11 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold transition duration-500 group-hover:scale-110 group-hover:bg-gold/20">
        {icon}
      </span>
      <h3 className="mt-4 font-display text-xl text-cream">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-cream/60">{body}</p>
    </div>
  );
}

type Row = { label: string; bronze: boolean | string; silver: boolean | string; gold: boolean | string };
const COMPARISON: Row[] = [
  { label: "Unlimited signature haircuts", bronze: true, silver: true, gold: true },
  { label: "Unlimited beard trims", bronze: false, silver: true, gold: true },
  { label: "Unlimited hot towel shaves", bronze: false, silver: false, gold: true },
  { label: "Priority booking (both locations)", bronze: true, silver: true, gold: "First choice" },
  { label: "Members-only time slots", bronze: false, silver: true, gold: true },
  
];

function Cell({ v }: { v: boolean | string }) {
  if (typeof v === "string") {
    return <div className="text-center text-sm text-cream/85">{v}</div>;
  }
  return (
    <div className="flex justify-center">
      {v ? (
        <Check className="h-4 w-4 text-gold" />
      ) : (
        <Minus className="h-4 w-4 text-cream/25" />
      )}
    </div>
  );
}
