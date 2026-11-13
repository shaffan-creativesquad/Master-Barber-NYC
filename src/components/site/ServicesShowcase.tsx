import { Link } from "@tanstack/react-router";
import { HAIRCUT_SERVICES, RAZOR_SERVICES, SERVICES, type Service } from "@/lib/site-data";
import { Scissors, Sparkles } from "lucide-react";

type Variant = "grid" | "list" | "carousel" | "grouped";

export function ServicesShowcase({ variant = "grouped" }: { variant?: Variant }) {
  if (variant === "grouped") {
    return (
      <div className="grid gap-14 lg:grid-cols-2">
        <ServiceGroup
          icon={<Scissors className="h-5 w-5" />}
          eyebrow="The Chair"
          title="Haircut Services"
          services={HAIRCUT_SERVICES}
        />
        <ServiceGroup
          icon={<Sparkles className="h-5 w-5" />}
          eyebrow="The Ritual"
          title="Razor Services"
          services={RAZOR_SERVICES}
        />
      </div>
    );
  }

  if (variant === "list") {
    return (
      <ul className="divide-y divide-white/5">
        {SERVICES.map((s) => (
          <li key={s.name} className="grid gap-2 py-6 md:grid-cols-[1fr_auto] md:items-baseline md:gap-8">
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="font-display text-2xl text-cream">{s.name}</h3>
                {s.duration && (
                  <span className="text-xs uppercase tracking-widest text-cream/50">{s.duration}</span>
                )}
                {s.popular && (
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold">
                    Guest favorite
                  </span>
                )}
              </div>
              {s.description && (
                <p className="mt-2 max-w-2xl text-sm text-cream/60">{s.description}</p>
              )}
            </div>
            <div className="font-numeric text-3xl font-semibold gold-text">{s.price}</div>
          </li>
        ))}
      </ul>
    );
  }

  if (variant === "carousel") {
    return (
      <div className="-mx-5 md:mx-0">
        <div className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-4 md:hidden">
          {SERVICES.slice(0, 8).map((s) => (
            <ServiceCard key={s.name} service={s} className="w-[78%] shrink-0 snap-start" />
          ))}
          <div className="w-2 shrink-0" />
        </div>
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {SERVICES.slice(0, 8).map((s) => (
            <ServiceCard key={s.name} service={s} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {SERVICES.map((s) => (
        <ServiceCard key={s.name} service={s} />
      ))}
    </div>
  );
}

function ServiceGroup({
  icon,
  eyebrow,
  title,
  services,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  services: Service[];
}) {
  return (
    <div className="card-lux p-8 md:p-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
          {icon}
        </span>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h3 className="mt-1 font-display text-2xl text-cream md:text-3xl">{title}</h3>
        </div>
      </div>
      <div className="mt-8 divide-y divide-white/5">
        {services.map((s) => (
          <div key={s.name} className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-lg text-cream transition-colors group-hover:text-gold">
                  {s.name}
                </span>
                {s.popular && (
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-gold">
                    Favorite
                  </span>
                )}
              </div>
              {s.description && (
                <p className="mt-1 text-xs text-cream/55 line-clamp-2">{s.description}</p>
              )}
            </div>
            <div className="text-right">
              <div className="font-numeric text-xl font-semibold gold-text">{s.price}</div>
              {s.duration && <div className="text-[10px] uppercase tracking-widest text-cream/40">{s.duration}</div>}
              <Link
                to="/book"
                search={{ service: s.name }}
                className="mt-1 inline-flex text-[10px] uppercase tracking-[0.22em] text-cream/50 transition hover:text-gold"
              >
                Book →
              </Link>
            </div>

          </div>
        ))}
      </div>
      <Link to="/book" className="btn-ghost mt-8 w-full">Book This Service</Link>
    </div>
  );
}

function ServiceCard({
  service,
  className = "",
}: {
  service: Service;
  className?: string;
}) {
  return (
    <article className={"card-lux flex h-full flex-col p-6 " + className}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg leading-tight text-cream">{service.name}</h3>
        <span className="font-numeric text-2xl font-semibold gold-text">{service.price}</span>
      </div>
      {service.duration && (
        <div className="mt-2 text-[10px] uppercase tracking-[0.24em] text-gold/80">
          {service.duration}
          {service.popular ? " · Favorite" : ""}
        </div>
      )}
      {service.description && (
        <p className="mt-4 flex-1 text-sm text-cream/60">{service.description}</p>
      )}
      <Link to="/book" search={{ service: service.name }} className="mt-6 inline-flex text-xs uppercase tracking-[0.24em] text-cream/70 hover:text-gold">
        Book this →
      </Link>
    </article>
  );
}
