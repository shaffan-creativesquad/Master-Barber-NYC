import { createFileRoute, Link } from "@tanstack/react-router";
import { BUSINESS } from "@/lib/site-data";
import { Phone } from "lucide-react";

export const Route = createFileRoute("/thank-you/")({
  head: () => ({
    meta: [
      { title: "Thank You | We'll Be in Touch | Master Barber NYC" },
      { name: "description", content: "Your booking request was received. We'll confirm within one business day." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Thank You | Master Barber NYC" },
      { property: "og:description", content: "Your request was received." },
      { property: "og:url", content: "https://masterbarbernyc.com/thank-you" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/thank-you" }],
  }),
  component: ThankYou,
});

function ThankYou() {
  return (
    <section className="bg-ink text-cream">
      <div className="container-x flex min-h-[80vh] flex-col items-center justify-center py-24 text-center">
        <div className="eyebrow text-gold">Received</div>
        <h1 className="mt-6 font-display text-5xl leading-[1.05] md:text-7xl">
          Thanks, your chair is being confirmed.
        </h1>
        <div className="hairline mx-auto mt-8 max-w-40" />
        <p className="mt-8 max-w-xl text-lg text-cream/75">
          One of our team will reach out within one business day to lock in
          your time. If you'd like to speak to us sooner, ring the shop
          directly.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href={BUSINESS.phoneHref}
            className="inline-flex h-12 items-center gap-2 rounded-sm bg-gold px-7 text-xs font-medium uppercase tracking-[0.24em] text-ink hover:brightness-105"
          >
            <Phone className="h-4 w-4" /> {BUSINESS.phone}
          </a>
          <Link
            to="/"
            className="inline-flex h-12 items-center rounded-sm border border-cream/30 px-6 text-xs font-medium uppercase tracking-[0.24em] text-cream hover:bg-cream/10"
          >
            Return Home
          </Link>
        </div>
      </div>
    </section>
  );
}
