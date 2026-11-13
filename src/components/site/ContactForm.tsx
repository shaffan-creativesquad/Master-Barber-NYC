import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SERVICES, membershipFromPrice } from "@/lib/site-data";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid phone number")
    .max(30),
  email: z.string().trim().email("Please enter a valid email").max(255),
  address: z.string().trim().min(2, "Please enter your address or neighborhood").max(200),
  location: z.string().trim().min(1, "Please pick a location"),
  service: z.string().trim().min(1, "Please pick a service"),
  message: z.string().trim().max(500).optional(),
});


type Props = {
  variant?: "light" | "dark";
  compact?: boolean;
};

export function ContactForm({ variant = "light", compact = false }: Props) {
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const dark = variant === "dark";
  const labelBase =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] " +
    (dark ? "text-cream/70" : "text-muted-foreground");
  const fieldBase = dark
    ? "w-full h-12 rounded-sm border border-cream/20 bg-cream/5 px-4 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none"
    : "w-full h-12 rounded-sm border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const data = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      address: String(fd.get("address") ?? ""),
      location: String(fd.get("location") ?? ""),
      service: String(fd.get("service") ?? ""),
      message: String(fd.get("message") ?? ""),
    };
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      setSubmitting(false);
      return;
    }
    setErrors({});

    try {
      const res = await fetch("https://formspree.io/f/xgaeweby", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          _subject: `New inquiry from ${parsed.data.name}, Master Barber NYC`,
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      navigate({ to: "/thank-you" });
    } catch {
      setErrors({ form: "Something went wrong. Please call the shop or try again." });
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className={compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
        <div>
          <label htmlFor="cf-name" className={labelBase}>Full Name</label>
          <input id="cf-name" name="name" placeholder="Full name" className={fieldBase} />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="cf-phone" className={labelBase}>Phone</label>
          <input id="cf-phone" name="phone" placeholder="Phone" inputMode="tel" className={fieldBase} />
          {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="cf-email" className={labelBase}>Email</label>
          <input id="cf-email" name="email" placeholder="Email" type="email" className={fieldBase} />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="cf-address" className={labelBase}>Address / Neighborhood</label>
          <input id="cf-address" name="address" placeholder="Address / Neighborhood" className={fieldBase} />
          {errors.address && <p className="mt-1 text-xs text-destructive">{errors.address}</p>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="cf-location" className={labelBase}>Preferred Location</label>
          <select
            id="cf-location"
            name="location"
            defaultValue=""
            className={
              fieldBase +
              " appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23c9a84c%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[position:right_1rem_center] bg-no-repeat pr-10"
            }
          >
            <option value="" disabled>Preferred location</option>
            <option value="Downtown Brooklyn">Downtown Brooklyn</option>
            <option value="Park Slope Brooklyn">Park Slope Brooklyn</option>
          </select>
          {errors.location && <p className="mt-1 text-xs text-destructive">{errors.location}</p>}
        </div>
        <div>
          <label htmlFor="cf-service" className={labelBase}>Service</label>
          <select
            id="cf-service"
            name="service"
            defaultValue=""
            className={
              fieldBase +
              " appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23c9a84c%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[position:right_1rem_center] bg-no-repeat pr-10"
            }
          >
            <option value="" disabled>Select a service</option>
            {SERVICES.map((s) => (
              <option key={s.name} value={s.name}>{s.name}, {s.price}</option>
            ))}
            <option value="Membership">Membership Inquiry, {membershipFromPrice()}/mo</option>
          </select>
          {errors.service && <p className="mt-1 text-xs text-destructive">{errors.service}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="cf-message" className={labelBase}>Message (Optional)</label>
        <textarea
          id="cf-message"
          name="message"
          rows={3}
          placeholder="Anything we should know? (optional)"
          className={
            (dark
              ? "w-full rounded-sm border border-cream/20 bg-cream/5 px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none"
              : "w-full rounded-sm border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none")
          }
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="btn-gold mt-2 w-full disabled:opacity-70"
      >
        {submitting ? "Sending…" : "Book My Appointment"}
      </button>
      {errors.form && <p className="text-xs text-destructive">{errors.form}</p>}

      <p className={"text-xs " + (dark ? "text-cream/50" : "text-muted-foreground")}>
        We respond within 24 hours. We confirm your booking within one business day. Prefer to talk? Call the shop.
      </p>
    </form>
  );
}
