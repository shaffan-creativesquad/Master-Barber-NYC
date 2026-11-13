import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  intro?: string;
  image: string;
};

export function PageHero({ eyebrow, title, intro, image }: Props) {
  return (
    <section className="relative isolate flex min-h-[42vh] items-center justify-center overflow-hidden bg-ink pt-36 pb-24 text-cream md:min-h-[48vh] md:pt-44 md:pb-32">
      <img
        src={image}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        width={1920}
        height={1080}
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-45"
      />
      {/* Dark overlay, fades to transparent at the bottom for a seamless hand-off */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,8,10,0.72) 0%, rgba(8,8,10,0.62) 40%, rgba(8,8,10,0.35) 75%, rgba(8,8,10,0) 100%)",
        }}
      />
      {/* Background image fade to solid ink at the bottom, over the image */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 md:h-56"
        style={{
          background:
            "linear-gradient(180deg, rgba(13,13,13,0) 0%, var(--color-ink) 100%)",
        }}
      />
      <div className="container-x text-center">
        {eyebrow && (
          <div className="eyebrow inline-block">{eyebrow}</div>
        )}
        <h1 className="mx-auto mt-5 max-w-4xl font-display text-4xl leading-[1.05] text-cream md:text-6xl lg:text-7xl">
          {title}
        </h1>
        <div className="rule-gold mx-auto mt-7 block" />
        {intro && (
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-cream/75 md:text-lg">
            {intro}
          </p>
        )}
      </div>
    </section>
  );
}
