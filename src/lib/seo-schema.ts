import { getFaqs, SITE_URL, HAIRCUT_SERVICES, RAZOR_SERVICES, POSTS } from "@/lib/site-data";

/** FAQPage schema built from the FAQ block rendered on the page. */
export function faqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: getFaqs().map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** BreadcrumbList for an inner page. Home is always the first crumb. */
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/** Priced service catalogue, used on the services and pricing pages. */
export function serviceCatalogSchema() {
  const all = [...HAIRCUT_SERVICES, ...RAZOR_SERVICES];
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Master Barber NYC service menu",
    url: `${SITE_URL}/pricing`,
    itemListElement: all.map((s: { name: string; price: string; description?: string }, i) => ({
      "@type": "Offer",
      position: i + 1,
      priceCurrency: "USD",
      price: s.price.replace(/[^0-9.]/g, ""),
      availability: "https://schema.org/InStock",
      itemOffered: {
        "@type": "Service",
        name: s.name,
        description: s.description ?? undefined,
        serviceType: "Barber service",
        provider: { "@type": "BarberShop", name: "Master Barber NYC", url: SITE_URL },
        areaServed: { "@type": "Place", name: "Brooklyn, New York" },
      },
    })),
  };
}

/** Blog + post list for the journal index. */
export function blogSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Master Barber NYC Journal",
    url: `${SITE_URL}/blog`,
    blogPost: POSTS.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.excerpt,
      datePublished: p.date,
      url: `${SITE_URL}/blog`,
      author: { "@type": "Organization", name: "Master Barber NYC" },
      publisher: { "@type": "Organization", name: "Master Barber NYC" },
    })),
  };
}
