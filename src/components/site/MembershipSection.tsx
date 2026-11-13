import { Link } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { getMemberships, type Membership } from "@/lib/site-data";

export function MembershipSection() {
  const featured = getMemberships().find((m) => m.id === "bronze-annual")!;
  const others = ["silver-monthly", "gold-monthly"].map(
    (id) => getMemberships().find((m) => m.id === id)!
  );

  return (
    <div>
      <div className="mt-12 space-y-6">
        {/* Featured tier, Bronze Unlimited, larger and centered */}
        {featured && (
          <article className="relative flex flex-col p-8 md:p-10 lg:p-12 card-ivory-featured">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-gold-deep/60 bg-gradient-to-b from-gold-soft via-gold to-gold-deep px-4 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-ink shadow-lg shadow-gold/30">
              <Crown className="mr-1.5 inline h-3 w-3" /> Most Popular
            </span>
            <div className="eyebrow-deep">{featured.tier} Unlimited</div>
            <h3 className="plan-title mt-3 text-3xl md:text-4xl">{featured.name}</h3>
            <p className="ivory-muted mt-3 min-h-[3rem] text-sm md:text-base">{featured.description}</p>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-numeric text-6xl font-semibold gold-text-deep">{featured.price}</span>
              <span className="ivory-muted text-sm uppercase tracking-widest">{featured.cadence}</span>
            </div>
            {featured.priceNote && (
              <p className="mt-1 text-sm font-medium text-ink/70">{featured.priceNote}</p>
            )}

            <ul className="mt-8 space-y-3 text-sm md:text-base">
              {featured.perks.map((p) => (
                <li key={p} className="ivory-text flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-600/15 text-emerald-700">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            {featured.terms && featured.terms.length > 0 && (
              <div className="mt-8 border-t border-ink/10 pt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Membership Terms</p>
                <ul className="mt-3 space-y-2">
                  {featured.terms.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm leading-relaxed text-ink/80">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold-deep" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              to="/members-checkout"
              search={{ plan: featured.id }}
              className="mt-10 w-full btn-silver"
            >
              Claim {featured.tier}
            </Link>
          </article>
        )}

        {/* Gold & Silver, smaller, tucked underneath */}
        <div className="grid gap-5 sm:grid-cols-2 lg:max-w-3xl lg:mx-auto">
          {others.map((m) => (
            <article key={m.id} className="relative flex flex-col p-6 md:p-8 card-ivory">
              <div className="eyebrow-deep">{m.tier} Unlimited</div>
              <h3 className="plan-title mt-3 text-xl">{m.name}</h3>
              <p className="ivory-muted mt-3 min-h-[3rem] text-sm">{m.description}</p>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-numeric text-4xl font-semibold ivory-text">{m.price}</span>
                <span className="ivory-muted text-xs uppercase tracking-widest">{m.cadence}</span>
              </div>

              <ul className="mt-6 space-y-2.5 text-sm">
                {m.perks.map((p) => (
                  <li key={p} className="ivory-text flex items-start gap-3">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-600/15 text-emerald-700">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/members-checkout"
                search={{ plan: m.id }}
                className="mt-8 w-full btn-outline-ink"
              >
                Choose {m.tier}
              </Link>
            </article>
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-xs uppercase tracking-[0.28em] text-cream/45">
        No contracts · Cancel any time · Valid at both Brooklyn locations
      </p>
    </div>
  );
}
