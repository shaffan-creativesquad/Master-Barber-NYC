import { blogSchema, breadcrumbSchema } from "@/lib/seo-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CTAFooter } from "@/components/site/CTAFooter";
import { ARTICLES } from "@/lib/blog-content";
import { SITE_IMAGES } from "@/lib/site-images";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Journal | Notes from the Chair | Master Barber NYC" },
      {
        name: "description",
        content:
          "Grooming notes from Brooklyn's Master Barber NYC: how to grow out a haircut, when a membership pays off, beard care and product advice from our barbers.",
      },
      { property: "og:title", content: "Journal | Master Barber NYC" },
      { property: "og:description", content: "Practical writing on hair, beards and grooming." },
      { property: "og:url", content: "https://masterbarbernyc.com/blog" },
      { property: "og:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
      { name: "twitter:image", content: "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/blog" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(blogSchema()) },
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Journal", path: "/blog" }])) },
    ],
  }),
  component: BlogPage,
});

function BlogPage() {
  return (
    <>
      <section className="bg-ink text-cream">
        <div className="container-x py-24 md:py-32">
          <div className="eyebrow">The Journal</div>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] md:text-7xl">
            Notes from the chair.
          </h1>
          <div className="hairline mt-8 max-w-40" />
          <p className="mt-8 max-w-xl text-lg text-cream/75">
            Short, practical writing from our barbers, how to grow out a
            cut, when to change your product, and the honest truth about
            what actually works.
          </p>
        </div>
      </section>

      <section className="container-x py-20 md:py-28">
        <ul className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.map((post, index) => (
            <li key={post.slug} className="group">
              <Link to="/blog/$slug" params={{ slug: post.slug }} className="block">
              <div className="aspect-[4/3] overflow-hidden rounded-md border border-white/8 bg-muted">
                <img
                  src={SITE_IMAGES.gallery[index % SITE_IMAGES.gallery.length]}
                  alt={`${post.title}, Master Barber NYC journal`}
                  loading="lazy"
                  decoding="async"
                  width={800}
                  height={600}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                />
              </div>
              <div className="mt-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <span>{post.date}</span>
                <span className="text-gold">•</span>
                <span>{post.readTime} read</span>
              </div>
              <h2 className="mt-3 font-display text-2xl leading-snug transition group-hover:text-gold">
                {post.title}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">{post.excerpt}</p>
              <span className="mt-4 inline-flex text-xs uppercase tracking-[0.22em] text-foreground/80 transition group-hover:text-gold">
                Read the article →
              </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <CTAFooter
        heading="Rather Sit in the Chair?"
        sub="Reading only gets you so far. Reserve a chair and we'll handle the rest."
      />
    </>
  );
}
