import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

type Item = { to: string; label: string; description: string };

export function RelatedLinks({
  title = "Keep exploring",
  items,
}: {
  title?: string;
  items: Item[];
}) {
  return (
    <section aria-labelledby="related-links-heading" className="border-t border-white/8 bg-ink">
      <div className="container-x py-16 md:py-20">
        <h2
          id="related-links-heading"
          className="font-display text-2xl text-cream md:text-3xl"
        >
          {title}
        </h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((i) => (
            <li key={i.to}>
              <Link
                to={i.to}
                className="group flex h-full flex-col justify-between gap-3 rounded-xl border border-white/10 p-6 transition hover:-translate-y-0.5 hover:border-gold"
              >
                <span className="font-display text-lg text-cream group-hover:text-gold">
                  {i.label}
                </span>
                <span className="text-sm leading-6 text-cream/70">{i.description}</span>
                <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gold">
                  View <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
