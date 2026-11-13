import { useEffect, useState } from "react";
import { Menu, X, Phone } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BUSINESS, LOGO_URL } from "@/lib/site-data";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { href: string; label: string };

const LEFT_NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/members-club", label: "Members Club" },
];

const RIGHT_NAV: NavItem[] = [
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

const ALL_NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/members-club", label: "Members Club" },
  { href: "/about", label: "About" },
  { href: "/service-area", label: "Service Area" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Journal" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const [signedIn, setSignedIn] = useState(false);
  const accountLabel = signedIn ? "My Account" : "Member Login";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Logo sizing tiers, always contained inside the header bar so it never
  // spills over the hero headline.
  const logoClass = scrolled
    ? "h-12 w-auto object-contain md:h-14 lg:h-16"
    : isHome
      ? "h-16 w-auto object-contain md:h-20 lg:h-24"
      : "h-14 w-auto object-contain md:h-16 lg:h-20";

  const headerHeight = scrolled
    ? "h-16 lg:h-20"
    : "h-20 lg:h-28";


  return (
    <>
      <Link
        to="/book"
        search={{ service: "First Haircut $20" }}
        className="fixed inset-x-0 top-0 z-[60] flex h-10 items-center justify-center bg-gold px-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-ink transition hover:brightness-110"
      >
        <span className="hidden sm:inline">First Haircut $20 —&nbsp;</span>
        <span>Book Now</span>
        <span aria-hidden="true" className="ml-2">→</span>
      </Link>

      <header
        className={
          "fixed inset-x-0 top-10 z-50 transition-all duration-300 " +
          (scrolled
            ? "border-b border-white/8 bg-ink/75 backdrop-blur-2xl"
            : "bg-gradient-to-b from-ink/55 via-ink/20 to-transparent")
        }
      >
        <div className={"container-wide flex items-center justify-between transition-all duration-300 " + headerHeight + " lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-16 xl:gap-24"}>
          {/* LEFT NAV */}
          <nav aria-label="Primary" className="hidden lg:flex items-center gap-6 xl:gap-8 justify-self-end">
            {LEFT_NAV.map((item) => (
              <Link
                key={item.href + item.label}
                to={item.href}
                className="text-[13px] xl:text-[14px] font-bold uppercase tracking-[0.22em] text-cream drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)] transition-colors hover:text-gold"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* CENTER LOGO */}
          <Link to="/" className="justify-self-center flex items-center justify-center" aria-label="Master Barber NYC home">
            <img
              src={LOGO_URL}
              alt="Master Barber NYC barbershop logo"
              width={320}
              height={96}
              className={"transition-all duration-300 " + logoClass}
            />
          </Link>

          {/* RIGHT NAV + CTA */}
          <nav aria-label="Secondary" className="hidden lg:flex items-center gap-6 xl:gap-8 justify-self-start">
            {RIGHT_NAV.map((item) => (
              <Link
                key={item.href + item.label}
                to={item.href}
                className="text-[13px] xl:text-[14px] font-bold uppercase tracking-[0.22em] text-cream drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)] transition-colors hover:text-gold"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/account"
              className="text-[13px] xl:text-[14px] font-bold uppercase tracking-[0.22em] text-cream drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)] transition-colors hover:text-gold"
            >
              {accountLabel}
            </Link>
            <Link
              to={BUSINESS.bookingUrl}
              className="inline-flex h-10 items-center justify-center bg-gradient-to-b from-[#7a5a1e] to-[#3d2c0e] px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/95 shadow-[inset_0_1px_0_rgba(217,176,98,0.55),inset_0_-1px_0_rgba(0,0,0,0.5)] transition hover:brightness-110"
            >
              Book an Appointment
            </Link>
          </nav>


          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-cream backdrop-blur lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>


      <div
        id="mobile-menu"
        className={
          "fixed inset-0 z-[70] transition duration-300 lg:hidden " +
          (menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")
        }
      >
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="absolute inset-0 h-full w-full bg-ink/75 backdrop-blur-sm"
          aria-label="Close menu overlay"
        />
        <aside
          className={
            "absolute inset-y-0 left-0 flex h-full w-[88%] max-w-sm flex-col bg-graphite text-cream shadow-2xl transition-transform duration-300 " +
            (menuOpen ? "translate-x-0" : "-translate-x-full")
          }
        >
          <div className="relative flex items-center justify-center gap-4 border-b border-white/10 px-5 py-6">
            <a
              href={BUSINESS.phoneHref ?? "tel:+13476899032"}
              aria-label="Call Master Barber NYC"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#e6c477] via-[#c9a84c] to-[#8a6c22] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_14px_rgba(201,168,76,0.35)]"
            >
              <Phone className="h-5 w-5" />
            </a>
            <Link to="/" onClick={() => setMenuOpen(false)} className="flex flex-1 items-center justify-center">
              <img src={LOGO_URL} alt="Master Barber NYC" className="h-28 w-auto max-w-full object-contain" />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 py-6">
            <ul className="space-y-1">
              {ALL_NAV.map((item) => (
                <li key={item.href + item.label}>
                  <Link
                    to={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-md px-3 py-3.5 text-lg font-medium text-cream/88 transition hover:bg-white/5 hover:text-gold"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/account"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-md px-3 py-3.5 text-lg font-medium text-gold transition hover:bg-white/5"
                >
                  {accountLabel}
                </Link>
              </li>
            </ul>
          </nav>

          <div className="border-t border-white/10 p-5">
            <Link to={BUSINESS.bookingUrl} onClick={() => setMenuOpen(false)} className="btn-gold w-full">
              Book an Appointment
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
