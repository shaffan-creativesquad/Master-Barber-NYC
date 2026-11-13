import { useState } from "react";
import { breadcrumbSchema } from "@/lib/seo-schema";
import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { CTAFooter } from "@/components/site/CTAFooter";
import { Lightbox } from "@/components/site/Lightbox";
import { GALLERY_IMAGES } from "@/lib/gallery-images";
import { SITE_IMAGES } from "@/lib/site-images";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery | The Work | Master Barber NYC" },
      {
        name: "description",
        content:
          "Recent haircuts, fades, beard sculpts and hot towel shaves at Master Barber NYC. A closer look at the craft coming out of both Brooklyn chairs.",
      },
      { property: "og:title", content: "Gallery | Master Barber NYC" },
      { property: "og:description", content: "Recent cuts and the room they were done in." },
      { property: "og:url", content: "https://masterbarbernyc.com/gallery" },
      { property: "og:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { name: "twitter:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/gallery" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Gallery", path: "/gallery" }])) },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <PageHero
        eyebrow="The Work"
        title={<>The room, the ritual, the <span className="two-tone-accent">result</span>.</>}
        intro="Close-up craft, finished cuts, and the atmosphere behind every appointment at Master Barber NYC."
        image={SITE_IMAGES.shave}
      />

      <section className="bg-ink py-20 md:py-24">
        <div className="container-wide">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
            {GALLERY_IMAGES.map((src, i) => (
              <button
                type="button"
                key={src}
                onClick={() => setOpen(i)}
                aria-label={`Open image ${i + 1} in lightbox`}
                className="group relative aspect-square overflow-hidden border border-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <img
                  src={src}
                  alt={`Haircut and beard work by Master Barber NYC in Brooklyn, example ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  width={600}
                  height={600}
                  className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.04]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {open !== null && (
        <Lightbox
          images={GALLERY_IMAGES}
          index={open}
          onIndexChange={setOpen}
          onClose={() => setOpen(null)}
          alt="Master Barber NYC, gallery"
        />
      )}

      <CTAFooter heading="Ready for a Chair?" sub="Reserve online in under a minute. Members always get first pick." />
    </>
  );
}
