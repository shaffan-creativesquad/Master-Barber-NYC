import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "../components/site/SiteHeader";
import { SiteFooter } from "../components/site/SiteFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-data";


function NotFoundComponent() {
  return (
    <>
      <SiteHeader />
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="eyebrow">Error 404</div>
          <h1 className="mt-4 font-display text-6xl">Page not found</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            That page has moved, or never existed. Head back to the shop.
          </p>
          <Link to="/" className="btn-gold mt-8">Return Home</Link>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl">This page didn't load</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Something went wrong on our end. Try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="btn-gold">Try again</button>
          <a href="/" className="btn-ghost">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#111114" },
      { property: "og:site_name", content: "Master Barber NYC" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "google-site-verification",
        content: "QHBOSmvbhnOcQ8Ruqkqnr4a8kaGlPOWCDpQIcvKt6Og",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      {
        async: true,
        src: "https://www.googletagmanager.com/gtag/js?id=G-TBE0M3RCVT",
      },
      {
        children: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-TBE0M3RCVT');
        `,
      },
      {
        async: true,
        src: "https://www.googletagmanager.com/gtag/js?id=G-LWJ1X00K6P",
      },
      {
        children: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-LWJ1X00K6P');
        `,
      },
      {
        async: true,
        src: "https://www.googletagmanager.com/gtag/js?id=G-97E6NLCYTX",
      },
      {
        children: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-97E6NLCYTX');
        `,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: `${SITE_URL}/`,
              name: "Master Barber NYC",
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: "Master Barber NYC",
              url: `${SITE_URL}/`,
              telephone: "+1-347-689-9032",
            },
            {
              "@type": "BarberShop",
              "@id": `${SITE_URL}/#park-slope`,
              name: "Master Barber NYC, Park Slope",
              url: `${SITE_URL}/service-area`,
              telephone: "+1-347-689-9032",
              priceRange: "$$",
              image: OG_IMAGE,
              address: {
                "@type": "PostalAddress",
                streetAddress: "169 7th Ave",
                addressLocality: "Brooklyn",
                addressRegion: "NY",
                postalCode: "11215",
                addressCountry: "US",
              },
              areaServed: "Brooklyn, NY",
              openingHoursSpecification: [
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Sunday"],
                  opens: "09:00",
                  closes: "19:00",
                },
              ],
            },
            {
              "@type": "BarberShop",
              "@id": `${SITE_URL}/#downtown`,
              name: "Master Barber NYC, Downtown Brooklyn",
              url: `${SITE_URL}/service-area`,
              telephone: "+1-347-457-6777",
              priceRange: "$$",
              image: OG_IMAGE,
              address: {
                "@type": "PostalAddress",
                streetAddress: "66 Bond St",
                addressLocality: "Brooklyn",
                addressRegion: "NY",
                postalCode: "11217",
                addressCountry: "US",
              },
              areaServed: "Brooklyn, NY",
              openingHoursSpecification: [
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Sunday"],
                  opens: "09:00",
                  closes: "19:00",
                },
              ],
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const bare = pathname.startsWith("/admin") || pathname.startsWith("/auth") || pathname.startsWith("/validator");
  return (
    <QueryClientProvider client={queryClient}>
      {!bare && <SiteHeader />}
      <main>
        <Outlet />
      </main>
      {!bare && <SiteFooter />}
    </QueryClientProvider>
  );
}
