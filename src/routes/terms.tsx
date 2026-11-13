import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/site/LegalLayout";
import { BUSINESS, membershipFromPrice } from "@/lib/site-data";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions | Master Barber NYC" },
      { name: "description", content: "The terms that apply when you use the Master Barber NYC website or visit our shop." },
      { property: "og:title", content: "Terms & Conditions | Master Barber NYC" },
      { property: "og:description", content: "Terms of use for our website and services." },
      { property: "og:url", content: "https://masterbarbernyc.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Terms & Conditions" updated="March 2026">
      <p>
        These terms apply when you use the {BUSINESS.name} website, book an
        appointment through it, or visit one of our shops. By using the
        site or booking with us, you agree to what's below.
      </p>

      <h2>Use of this website</h2>
      <p>
        You're welcome to browse, contact us and book appointments through
        this site for personal, non-commercial use. Don't try to copy or
        republish large sections of the site, disrupt how it runs, or use
        it to send spam, viruses or anything harmful.
      </p>

      <h2>Booking and service terms</h2>
      <ul>
        <li>Booking a chair is a request for service, we'll confirm the appointment by phone, text or email.</li>
        <li>Please arrive on time. Arriving more than 10 minutes late may mean we can't complete the full service.</li>
        <li>Payment is due at the end of your visit unless you're on an active membership plan.</li>
        <li>We accept cash and major cards. Tips are always appreciated but never required.</li>
        <li>Memberships require a 6-month minimum term. Cancellations are subject to a cancellation fee equal to one month of membership ({membershipFromPrice()}) plus any remaining balance. Members must call the barbershop to cancel; online cancellation is not available.</li>
      </ul>

      <h2>Cancellations and no-shows</h2>
      <p>
        We ask for at least 4 hours' notice on cancellations so we can
        offer the chair to someone else. Repeated late cancellations or
        no-shows may affect your ability to book in advance.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        {BUSINESS.name} is not responsible for indirect or consequential
        losses connected to your use of the website or your visit to the
        shop, except where liability can't be excluded by law. If a
        service doesn't go the way you hoped, please tell us in the shop
        so we can address it directly.
      </p>

      <h2>Personal items</h2>
      <p>
        Please keep personal belongings with you during your visit. We're
        not responsible for items left behind in the shop.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the State of New York. Any
        dispute related to the website or our services will be handled in
        the state or federal courts located in Kings County, New York.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms occasionally to reflect changes in how
        we run the shop or website. The current version is always the one
        posted on this page.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> or call{" "}
        <a href={BUSINESS.phoneHref}>{BUSINESS.phone}</a>.
      </p>
    </LegalLayout>
  );
}
