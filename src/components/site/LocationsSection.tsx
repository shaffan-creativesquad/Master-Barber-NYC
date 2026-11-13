import { LOCATIONS } from "@/lib/site-data";
import { MapPin, Phone, Navigation } from "lucide-react";

export function LocationsSection() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {LOCATIONS.map((loc) => (
        <div
          key={loc.name}
          className="card-ivory overflow-hidden rounded-2xl"
        >
          <iframe
            title={`Master Barber NYC, ${loc.name} map`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(loc.mapQuery)}&output=embed`}
            className="h-[280px] w-full md:h-[320px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="space-y-4 p-6">
            <h3 className="font-display text-2xl ivory-text">{loc.name}</h3>
            <div className="flex items-start gap-3 text-sm ivory-text">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
              <span>{loc.address}</span>
            </div>
            <div className="flex items-center gap-3 text-sm ivory-text">
              <Phone className="h-4 w-4 shrink-0 text-gold-deep" />
              <a href={loc.phoneHref} className="transition hover:text-gold-deep">
                {loc.phone}
              </a>
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <a href={loc.phoneHref} className="btn-gold-solid flex-1">
                Call {loc.name}
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.mapQuery)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-outline-ink flex-1 gap-2"
              >
                <Navigation className="h-3.5 w-3.5" />
                Directions
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
