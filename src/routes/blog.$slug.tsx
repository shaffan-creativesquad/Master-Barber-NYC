import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CTAFooter } from "@/components/site/CTAFooter";
import { ARTICLES, getArticle } from "@/lib/blog-content";
import { SITE_IMAGES } from "@/lib/site-images";
import { breadcrumbSchema } from "@/lib/seo-schema";

const SITE = "https://masterbarbernyc.com";
const OG_IMAGE =
  "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Article Unavailable | Master Barber NYC" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const a = loaderData.article;
    const url = `${SITE}/blog/${params.slug}`;
    return {
      meta: [
        { title: `${a.title} | Master Barber NYC Journal` },
        { name: "description", content: a.excerpt },
        { property: "og:title", content: a.title },
        { property: "og:description", content: a.excerpt },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: OG_IMAGE },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: OG_IMAGE },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: a.title,
            description: a.excerpt,
            datePublished: a.isoDate,
            dateModified: a.isoDate,
            image: OG_IMAGE,
            mainEntityOfPage: url,
            author: { "@type": "Organization", name: "Master Barber NYC" },
            publisher: {
              "@type": "Organization",
              name: "Master Barber NYC",
              url: SITE,
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            breadcrumbSchema([
              { name: "Journal", path: "/blog" },
              { name: a.title, path: `/blog/${params.slug}` },
            ]),
          ),
        },
      ],
    };
  },
  notFoundComponent: ArticleNotFound,
  component: ArticlePage,
});

function ArticleNotFound() {
  return (
    <section className="container-x py-32 text-center">
      <h1 className="font-display text-4xl">We couldn't find that article.</h1>
      <p className="mt-4 text-muted-foreground">
        It may have moved. Browse the Journal for everything we've published.
      </p>
      <Link to="/blog" className="btn-gold mt-8 inline-flex">
        Back to the Journal
      </Link>
    </section>
  );
}

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const index = ARTICLES.findIndex((a) => a.slug === article.slug);
  const hero = SITE_IMAGES.gallery[index % SITE_IMAGES.gallery.length];
  const more = ARTICLES.filter((a) => a.slug !== article.slug);

  return (
    <>
      <section className="bg-ink text-cream">
        <div className="container-x py-20 md:py-28">
          <Link
            to="/blog"
            className="text-[10px] uppercase tracking-[0.28em] text-cream/60 transition hover:text-gold"
          >
            ← The Journal
          </Link>
          <h1 className="mt-6 max-w-4xl font-display text-4xl leading-[1.08] md:text-6xl">
            {article.title}
          </h1>
          <div className="mt-8 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-cream/60">
            <span>{article.date}</span>
            <span className="text-gold">•</span>
            <span>{article.readTime} read</span>
            <span className="text-gold">•</span>
            <span>{article.author}</span>
          </div>
        </div>
      </section>

      <article className="container-x py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="aspect-[16/9] overflow-hidden rounded-md border border-white/8 bg-muted">
            <img
              src={hero}
              alt={`${article.title}, Master Barber NYC journal`}
              width={1200}
              height={675}
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>

          <p className="mt-10 text-lg leading-relaxed text-foreground/90">{article.intro}</p>

          <div className="mt-10 space-y-6">
            {article.blocks.map((block, i) => {
              if (block.type === "h2") {
                return (
                  <h2 key={i} className="mt-12 font-display text-2xl md:text-3xl">
                    {block.text}
                  </h2>
                );
              }
              if (block.type === "list") {
                return (
                  <ul key={i} className="space-y-3">
                    {block.items.map((item) => (
                      <li key={item} className="flex gap-3 text-muted-foreground">
                        <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                );
              }
              if (block.type === "quote") {
                return (
                  <blockquote
                    key={i}
                    className="border-l-2 border-gold pl-6 font-display text-xl leading-snug text-foreground/90"
                  >
                    {block.text}
                  </blockquote>
                );
              }
              return (
                <p key={i} className="leading-relaxed text-muted-foreground">
                  {block.text}
                </p>
              );
            })}
          </div>

          <div className="mt-14 rounded-md border border-white/10 bg-white/[0.03] p-8">
            <div className="eyebrow">The Short Version</div>
            <ul className="mt-4 space-y-3">
              {article.takeaways.map((t) => (
                <li key={t} className="flex gap-3 text-sm text-foreground/85">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/book" className="btn-gold">
                Book an Appointment
              </Link>
              <Link to="/pricing" className="btn-outline">
                See Pricing
              </Link>
            </div>
          </div>

          <div className="mt-16">
            <div className="eyebrow">Keep Reading</div>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2">
              {more.map((a) => (
                <li key={a.slug}>
                  <Link
                    to="/blog/$slug"
                    params={{ slug: a.slug }}
                    className="group block rounded-md border border-white/8 p-6 transition hover:border-gold/40"
                  >
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {a.readTime} read
                    </div>
                    <h3 className="mt-3 font-display text-xl leading-snug transition group-hover:text-gold">
                      {a.title}
                    </h3>
                    <p className="mt-3 text-sm text-muted-foreground">{a.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      <CTAFooter
        heading="Rather Sit in the Chair?"
        sub="Reading only gets you so far. Reserve a chair and we'll handle the rest."
      />
    </>
  );
}
