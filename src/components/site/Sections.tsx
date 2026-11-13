import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { getFaqs, type Faq, LOCATIONS, NEIGHBORHOODS, PROCESS, TESTIMONIALS } from "@/lib/site-data";
import { ChevronDown, MapPin, Star, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  sub,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2 className="mt-5 font-display text-5xl leading-[1.02] text-cream md:text-6xl lg:text-7xl">
        {title}
      </h2>
      {sub && (
        <p
          className={
            "mt-6 text-base leading-8 text-cream/65 md:text-lg " +
            (align === "center" ? "mx-auto max-w-xl" : "max-w-xl")
          }
        >
          {sub}
        </p>
      )}
      <div className={"rule-gold mt-8 " + (align === "center" ? "mx-auto block" : "")} />
    </div>
  );
}

export function ProcessSection({ variant = "steps" }: { variant?: "steps" | "cards" }) {
  if (variant === "cards") {
    return (
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {PROCESS.map((p) => (
          <div key={p.step} className="card-lux p-6">
            <div className="font-numeric text-4xl font-semibold gold-text">{p.step}</div>
            <h3 className="mt-3 font-display text-xl text-cream">{p.title}</h3>
            <p className="mt-2 text-sm leading-7 text-cream/60">{p.body}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ol className="grid gap-10 md:grid-cols-4">
      {PROCESS.map((p, i) => (
        <li key={p.step} className="relative">
          <div className="flex items-center gap-4">
            <span className="font-numeric text-3xl font-semibold gold-text">{p.step}</span>
            {i < PROCESS.length - 1 && (
              <span className="hidden h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent md:block" />
            )}
          </div>
          <h3 className="mt-4 font-display text-2xl text-cream">{p.title}</h3>
          <p className="mt-2 text-sm leading-7 text-cream/60">{p.body}</p>
        </li>
      ))}
    </ol>
  );
}

function SharpStar({ filled = true, className = "" }: { filled?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.4}
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 6.4 7 .7-5.3 4.8 1.6 6.9L12 17.9l-6.2 3.4 1.6-6.9L2.1 9.6l7-.7L12 2.5z" />
    </svg>
  );
}

export function TestimonialsSection() {
  const [i, setI] = useState(0);
  const total = TESTIMONIALS.length;
  const go = (n: number) => setI(((n % total) + total) % total);
  const t = TESTIMONIALS[i];

  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="flex justify-center gap-1.5 text-gold">
        {Array.from({ length: 5 }).map((_, k) => (
          <SharpStar key={k} className="h-4 w-4" />
        ))}
      </div>

      <blockquote
        key={t.name}
        className="mt-8 text-xl leading-[1.55] text-cream/90 md:text-2xl lg:text-[1.65rem] animate-in fade-in duration-500"
        style={{ fontFamily: "var(--font-body)" }}
      >
        “{t.quote}”
      </blockquote>


      <div className="mt-10 flex flex-col items-center gap-2">
        <div className="h-px w-12 bg-gold/60" />
        <div className="mt-2 font-display text-lg text-cream">{t.name}</div>
        <div className="text-[11px] uppercase tracking-[0.28em] text-cream/50">
          {t.role}
        </div>
      </div>

      <div className="mt-10 flex items-center justify-center gap-6">
        <button
          onClick={() => go(i - 1)}
          aria-label="Previous testimonial"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-cream/70 transition hover:border-gold hover:text-gold"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          {TESTIMONIALS.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              aria-label={`Testimonial ${k + 1}`}
              className={
                "h-1.5 rounded-full transition-all " +
                (k === i ? "w-8 bg-gold" : "w-1.5 bg-cream/25 hover:bg-cream/50")
              }
            />
          ))}
        </div>

        <button
          onClick={() => go(i + 1)}
          aria-label="Next testimonial"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-cream/70 transition hover:border-gold hover:text-gold"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function FAQSection({ items }: { items?: Faq[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {(items ?? getFaqs()).map((f) => (
        <details
          key={f.q}
          className="card-ivory group px-6 py-5 md:px-8 md:py-6"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
            <h3 className="font-display text-xl leading-snug ivory-text md:text-2xl">
              {f.q}
            </h3>
            <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center text-gold-deep transition duration-300 group-open:rotate-180">
              <ChevronDown className="h-4 w-4" />
            </span>
          </summary>
          <div className="grid grid-rows-[0fr] transition-all duration-300 group-open:mt-4 group-open:grid-rows-[1fr]">
            <div className="overflow-hidden">
              <p className="max-w-2xl text-sm leading-8 ivory-muted md:text-[15px]">
                {f.a}
              </p>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

export function ServiceAreaSection() {
  const [active, setActive] = useState(0);
  const loc = LOCATIONS[active];

  return (
    <div className="grid gap-10 md:grid-cols-2 md:items-center">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-graphite shadow-2xl">
        <div className="flex border-b border-white/10">
          {LOCATIONS.map((l, i) => (
            <button
              key={l.name}
              type="button"
              onClick={() => setActive(i)}
              className={
                "flex-1 px-4 py-3 text-[11px] uppercase tracking-[0.22em] transition " +
                (i === active
                  ? "bg-gold/15 text-gold"
                  : "text-white/70 hover:text-gold")
              }
            >
              {l.name}
            </button>
          ))}
        </div>
        <iframe
          key={loc.mapQuery}
          title={`Master Barber NYC, ${loc.name} map`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(loc.mapQuery)}&output=embed`}
          className="h-[380px] w-full grayscale contrast-125 [color-scheme:dark] md:h-[420px]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="flex flex-col gap-2 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-lg text-white">{loc.name}</div>
            <div className="mt-1 text-xs text-white">{loc.address}</div>
          </div>
          <div className="flex items-center gap-4">
            <a href={loc.phoneHref} className="text-sm text-white transition hover:text-gold">
              {loc.phone}
            </a>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.mapQuery)}`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white transition hover:text-gold"
            >
              Directions →
            </a>
          </div>
        </div>
      </div>
      <div>
        <SectionHeader
          eyebrow="Service Area"
          title="Rooted in Brooklyn."
          sub="Two owner-operated locations, Park Slope on 7th Ave and Downtown on Bond St, serving members and walk-ins from every neighborhood inside a short train ride."
        />
        <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3">
          {NEIGHBORHOODS.map((n) => (
            <li
              key={n}
              className="group flex cursor-default items-center gap-2 text-sm text-white transition hover:-translate-y-0.5 hover:text-gold"
            >
              <MapPin className="h-3.5 w-3.5 text-gold" />
              <span>{n}</span>
              <span className="ml-auto text-gold opacity-0 transition group-hover:opacity-100">→</span>
            </li>
          ))}
        </ul>
        <Link to="/book" className="btn-gold mt-10">Book an Appointment</Link>
      </div>
    </div>
  );
}

// re-export unused Star to appease imports elsewhere
export { Star };
