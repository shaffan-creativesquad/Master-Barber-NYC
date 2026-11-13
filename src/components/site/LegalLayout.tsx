import type { ReactNode } from "react";

export function LegalLayout({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <>
      <section className="bg-ink text-cream">
        <div className="container-x py-20 md:py-24">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] md:text-6xl">{title}</h1>
          <div className="hairline mt-8 max-w-40" />
          {updated && (
            <p className="mt-6 text-xs uppercase tracking-[0.22em] text-cream/60">
              Last updated {updated}
            </p>
          )}
        </div>
      </section>
      <section className="container-x py-16 md:py-24">
        <article className="prose-legal mx-auto max-w-3xl space-y-6 text-base leading-relaxed text-foreground/85 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-foreground [&_a]:text-gold [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul_li]:mt-2">
          {children}
        </article>
      </section>
    </>
  );
}
