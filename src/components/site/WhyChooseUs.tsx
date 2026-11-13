import { Scissors, MapPin, Crown, Sparkles, Award, ShieldCheck } from "lucide-react";
import { membershipFromPrice } from "@/lib/site-data";

const getFeatures = () => [
  {
    icon: Scissors,
    title: "Master-Level Craft",
    body: "Classic technique. Modern fades. No rotating chairs.",
  },
  {
    icon: MapPin,
    title: "Two Brooklyn Rooms",
    body: "Park Slope and Downtown Brooklyn. Owner-operated, six days a week.",
  },
  {
    icon: Crown,
    title: "Membership Worth It",
    body: `Unlimited cuts from ${membershipFromPrice()}. Break even in two visits.`,
  },
  {
    icon: Sparkles,
    title: "Upscale, Unhurried",
    body: "Leather, brass, low lighting. A private-club energy.",
  },
  {
    icon: Award,
    title: "Precision Every Time",
    body: "Your part, your fade, your finish, remembered.",
  },
  {
    icon: ShieldCheck,
    title: "Honest Pricing",
    body: "Menu prices are what you pay. No upsell games.",
  },
];

export function WhyChooseUs() {
  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <div className="eyebrow">Why Master Barber</div>
        <h2 className="mt-5 font-display text-4xl leading-[1.05] text-cream md:text-5xl lg:text-6xl">
          Premium by Feel
          <br />
          <span className="two-tone-accent">Precise by Habit</span>
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-cream/68 md:text-lg">
          The room. The pace. The consistency. Every detail built to feel
          elevated before the cape even snaps on.
        </p>
        <div className="rule-gold mx-auto mt-8 block" />
      </div>

      {/* Elegant divider grid, no card backgrounds. Hairlines form subtle cross separators. */}
      <div className="mx-auto mt-20 max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {getFeatures().map((f, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            return (
              <article
                key={f.title}
                className={
                  "group relative flex flex-col items-center px-8 py-12 text-center transition-all duration-500 " +
                  // vertical dividers
                  (col !== 0 ? "md:border-l md:border-white/8 " : "") +
                  (col !== 0 ? "sm:max-md:odd:border-l sm:max-md:odd:border-white/8 " : "") +
                  // horizontal divider below top row
                  (row === 0 ? "md:border-b md:border-white/8 " : "") +
                  "hover:bg-white/[0.02]"
                }
              >
                <span className="inline-flex h-14 w-14 items-center justify-center text-gold transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_18px_rgba(201,168,76,0.55)]">
                  <f.icon className="h-6 w-6" strokeWidth={1.4} />
                </span>
                <h3 className="mt-6 font-display text-2xl text-cream md:text-[1.6rem] transition-colors duration-500 group-hover:text-gold-soft">
                  {f.title}
                </h3>
                <div className="mx-auto mt-3 h-px w-8 bg-gold/50 transition-all duration-500 group-hover:w-16 group-hover:bg-gold" />
                <p className="mt-4 max-w-xs text-sm leading-7 text-cream/62">
                  {f.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
