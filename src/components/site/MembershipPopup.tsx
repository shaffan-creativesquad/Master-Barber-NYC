import { useEffect, useState } from "react";
import { X, Check, Crown } from "lucide-react";
import popupImage from "@/assets/membership-popup.png";
import { membershipFromPrice } from "@/lib/site-data";

const STORAGE_KEY = "mb-membership-popup-dismissed";

export function MembershipPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setOpen(true), 2200);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 px-4 backdrop-blur-md">
      <div className="card-ivory relative w-full max-w-3xl overflow-hidden rounded-2xl shadow-[0_50px_120px_-30px_rgba(0,0,0,0.9)]">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(65%_55%_at_25%_0%,color-mix(in_oklab,var(--color-gold)_28%,transparent),transparent_72%)]" />
        <button
          onClick={close}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-ivory-ink/15 bg-ivory-ink/5 text-ivory-ink/70 transition hover:bg-ivory-ink/10 hover:text-ivory-ink"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="relative grid gap-0 md:grid-cols-2">
          <div className="relative px-6 pb-8 pt-10 text-center md:px-8 md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-deep/45 bg-gold/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-ivory-ink">
              <Crown className="h-3 w-3" /> Members Club
            </div>
            <h2 className="mt-4 font-display text-3xl leading-tight ivory-text">
              Unlimited Cuts. One Flat Rate.
            </h2>
            <div className="mt-3 h-px w-16 bg-gold-deep/50 mx-auto md:mx-0" />
            <p className="mt-4 text-sm ivory-muted">
              Join Brooklyn's most-loved barbershop membership. Priority booking
              and unlimited cuts at both locations.
            </p>
            <div className="mt-6 flex items-baseline justify-center gap-2 md:justify-start">
              <span className="font-display text-5xl ivory-text">{membershipFromPrice()}</span>
              <span className="text-xs uppercase tracking-widest ivory-muted">/ month</span>
            </div>
            <ul className="mt-6 space-y-2 text-left text-sm ivory-text">
              {[
                "Unlimited haircuts",
                "Unlimited beard trims",
                "Unlimited hot towel shaves",
                "Priority booking, both locations",
              ].map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-gold-deep" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <a href="/members-checkout?plan=bronze-monthly" onClick={close} className="btn-gold-solid mt-8 w-full">
              Claim My Membership
            </a>
            <button
              onClick={close}
              className="mt-3 w-full text-xs uppercase tracking-widest ivory-muted transition hover:text-ivory-ink"
            >
              Maybe later
            </button>
          </div>
          <div className="relative order-first min-h-[200px] md:order-last md:min-h-full">
            <img
              src={popupImage}
              alt="Master Barber NYC client with a fresh fade and beard trim"
              className="h-full w-full object-cover md:absolute md:inset-0"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
