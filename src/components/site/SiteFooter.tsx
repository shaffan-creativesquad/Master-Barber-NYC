import { Link } from "@tanstack/react-router";
import { Phone, Mail, Instagram, Facebook } from "lucide-react";
import { BUSINESS, LOCATIONS, LOGO_URL } from "@/lib/site-data";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/8 bg-ink text-cream">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      {/* Masthead */}
      <div className="container-x pt-20 pb-14">
        <div className="flex flex-col items-center text-center">
          <Link to="/" aria-label="Master Barber NYC home">
            <img
              src={LOGO_URL}
              alt="Master Barber NYC"
              className="h-16 w-auto object-contain md:h-20"
              loading="lazy"
              decoding="async"
              width={320}
              height={96}
            />
          </Link>
          <div className="mt-5 font-display text-3xl md:text-4xl">
            Master <span className="two-tone-accent">Barber</span> NYC
          </div>
          <div className="mt-3 text-[11px] uppercase tracking-[0.36em] text-cream/45">
            Brooklyn · A Cut Above
          </div>

          <div className="mt-8 flex items-center gap-3">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/12 text-cream/70 transition hover:border-gold hover:text-gold"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/12 text-cream/70 transition hover:border-gold hover:text-gold"
            >
              <Facebook className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mx-auto mt-14 h-px max-w-3xl bg-gradient-to-r from-transparent via-white/12 to-transparent" />

        {/* Three balanced columns */}
        <div className="mt-14 grid gap-12 md:grid-cols-3">
          <div className="text-center md:text-left">
            <div className="eyebrow">Locations</div>
            <ul className="mt-5 space-y-5 text-sm">
              {LOCATIONS.map((l) => (
                <li key={l.name}>
                  <div className="font-display text-base text-cream">{l.name}</div>
                  <div className="mt-1 text-xs leading-6 text-white">
                    {l.address}
                  </div>
                  <a href={l.phoneHref} className="mt-1 inline-block text-xs text-white transition hover:text-gold">
                    {l.phone}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center">
            <div className="eyebrow">Explore</div>
            <ul className="mt-5 space-y-3 text-sm text-cream/72">
              <li><Link to="/" className="transition hover:text-gold">Home</Link></li>
              <li><Link to="/services" className="transition hover:text-gold">Services</Link></li>
              <li><Link to="/pricing" className="transition hover:text-gold">Pricing</Link></li>
              <li><Link to="/members-club" className="transition hover:text-gold">Members Club</Link></li>
              <li><Link to="/account" className="transition hover:text-gold">Member Sign In</Link></li>
              <li><Link to="/about" className="transition hover:text-gold">About</Link></li>
              <li><Link to="/service-area" className="transition hover:text-gold">Service Area</Link></li>
              <li><Link to="/gallery" className="transition hover:text-gold">Gallery</Link></li>
              <li><Link to="/blog" className="transition hover:text-gold">Journal</Link></li>
              <li><Link to="/book" className="transition hover:text-gold">Book an Appointment</Link></li>
              <li><Link to="/contact" className="transition hover:text-gold">Contact</Link></li>
            </ul>
          </div>

          <div className="text-center md:text-right">
            <div className="eyebrow">Contact</div>
            <ul className="mt-5 space-y-3 text-sm">
              {LOCATIONS.map((l) => (
                <li key={l.name} className="flex items-center justify-center gap-2 md:justify-end">
                  <Phone className="h-3.5 w-3.5 text-gold" />
                  <a href={l.phoneHref} className="text-white transition hover:text-gold">
                    <span className="text-white/60">{l.name}:</span> {l.phone}
                  </a>
                </li>
              ))}
              <li className="flex items-center justify-center gap-2 md:justify-end">
                <Mail className="h-3.5 w-3.5 text-gold" />
                <a href={`mailto:${BUSINESS.email}`} className="text-white transition hover:text-gold">
                  {BUSINESS.email}
                </a>
              </li>
            </ul>
            <div className="mt-6 text-[11px] leading-6 text-white/80">
              Mon – Fri · 9AM – 7PM<br />
              Sunday · 9AM – 7PM<br />
              Saturday · Closed
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/8">
        <div className="container-x flex flex-col gap-4 py-6 text-[11px] uppercase tracking-[0.2em] text-cream/40 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
          <ul className="flex flex-wrap items-center gap-6">
            <li><Link to="/privacy" className="transition hover:text-cream">Privacy</Link></li>
            <li><Link to="/terms" className="transition hover:text-cream">Terms</Link></li>
            <li><Link to="/disclaimer" className="transition hover:text-cream">Disclaimer</Link></li>
            <li><Link to="/auth" search={{ redirect: null }} className="transition hover:text-cream">Staff Login</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
