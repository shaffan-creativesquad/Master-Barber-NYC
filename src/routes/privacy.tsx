import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/site/LegalLayout";
import { BUSINESS } from "@/lib/site-data";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Master Barber NYC" },
      { name: "description", content: "How Master Barber NYC collects, uses and protects the information you share when you book an appointment or contact our Brooklyn barbershop." },
      { property: "og:title", content: "Privacy Policy | Master Barber NYC" },
      { property: "og:description", content: "Read our privacy policy." },
      { property: "og:url", content: "https://masterbarbernyc.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://masterbarbernyc.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Privacy Policy" updated="March 2026">
      <p>
        {BUSINESS.name} respects your privacy. This policy explains what we
        collect when you use this website or book a service, how we use
        it, and how you can get in touch about it.
      </p>

      <h2>What we collect</h2>
      <p>When you fill out a form on this site, we collect the information you send us, which usually includes:</p>
      <ul>
        <li>Your name</li>
        <li>Your phone number</li>
        <li>Your email address</li>
        <li>Your address or neighborhood</li>
        <li>The service you're interested in and any note you add</li>
      </ul>
      <p>
        We may also collect basic technical information (device type,
        browser and general location) through standard analytics tools,
        so we can understand which pages people find useful.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To confirm and prepare for your appointment</li>
        <li>To reply to your message or reservation request</li>
        <li>To manage your membership if you have one</li>
        <li>To send occasional updates about promotions, hours or new services (only if you opt in)</li>
        <li>To improve how the website and shop work</li>
      </ul>
      <p>We don't sell or rent your personal information to anyone.</p>

      <h2>How we protect your information</h2>
      <p>
        We use standard security practices to keep your information safe,
        including secure hosting and access controls. No system is 100%
        secure, but we treat your data with care and only keep it as long
        as we need it.
      </p>

      <h2>Third-party tools</h2>
      <p>The site may use trusted third-party services, including:</p>
      <ul>
        <li>A booking or scheduling provider to manage appointments</li>
        <li>A payment processor for in-shop card and membership payments</li>
        <li>Google Maps to show our location</li>
        <li>Analytics tools to understand website traffic in aggregate</li>
      </ul>
      <p>
        Those providers have their own privacy policies that apply when
        you interact with them.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask us to update or delete the information we hold about
        you at any time. Just email{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> and we'll
        take care of it.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy? Reach us at{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> or call{" "}
        <a href={BUSINESS.phoneHref}>{BUSINESS.phone}</a>. You can also
        write to us at {BUSINESS.address.line1}, {BUSINESS.address.line2}.
      </p>
    </LegalLayout>
  );
}
