import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/site/LegalLayout";
import { BUSINESS } from "@/lib/site-data";

export const Route = createFileRoute("/disclaimer")({
  head: () => ({
    meta: [
      { title: "Disclaimer | Master Barber NYC" },
      { name: "description", content: "General disclaimer covering the information, pricing and grooming services published on the Master Barber NYC website in Brooklyn, NY." },
      { property: "og:title", content: "Disclaimer | Master Barber NYC" },
      { property: "og:description", content: "Read our general service and website disclaimer." },
      { property: "og:url", content: "https://masterbarbernyc.com/disclaimer" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/disclaimer" }],
  }),
  component: DisclaimerPage,
});

function DisclaimerPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Disclaimer" updated="March 2026">
      <p>
        The information on this website is provided by {BUSINESS.name} for
        general information about our barbershop, services and pricing. We
        do our best to keep everything current, but we can't guarantee that
        every detail is complete, accurate or up to date at all times.
      </p>

      <h2>Service disclaimer</h2>
      <p>
        Every haircut, shave and beard service is delivered by a
        professional barber to the best of their ability. Personal
        preferences and hair types vary, the final result depends on
        clear communication at the chair. If you're ever unhappy with
        something, please tell us before you leave the shop so we can
        make it right.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        {BUSINESS.name}, its owner and staff are not responsible for any
        indirect, incidental or consequential loss that may result from
        your use of this website or a visit to our shop, except where
        that liability can't be excluded by law. If you have a skin
        condition, allergy or sensitivity, please let your barber know
        before service begins.
      </p>

      <h2>Accuracy of information</h2>
      <p>
        Prices, hours and service descriptions may change without notice.
        The version of the site you're reading is the current version;
        older printed materials, screenshots or third-party listings may
        be out of date. For anything time-sensitive, please call the shop
        at <a href={BUSINESS.phoneHref}>{BUSINESS.phone}</a> to confirm.
      </p>

      <h2>External links</h2>
      <p>
        This site may link to third-party websites (for example our
        booking system, social media or a map service). We provide those
        links for convenience only. We don't control those sites and
        aren't responsible for their content, policies or availability.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about anything on this page? Reach us at{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
      </p>
    </LegalLayout>
  );
}
