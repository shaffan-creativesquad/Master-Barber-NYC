import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMembershipCheckoutStatus } from "@/lib/membership.functions";
import { Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/thank-you/members/success/$id")({
  head: () => ({
    meta: [
      { title: "Membership Confirmed | Master Barber NYC" },
      { name: "description", content: "Your Master Barber NYC unlimited membership is active. Book your first chair at either Brooklyn location." },
      { property: "og:title", content: "Membership Confirmed | Master Barber NYC" },
      { property: "og:description", content: "Welcome to the Members Club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MembershipSuccess,
});

function MembershipSuccess() {
  const { id } = Route.useParams();
  const statusFn = useServerFn(getMembershipCheckoutStatus);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMembershipCheckoutStatus>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    statusFn({ data: { session_id: id } })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id, statusFn]);

  return (
    <section className="bg-ink text-cream">
      <div className="container-x flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
        {!data && !error && (
          <div className="flex items-center gap-3 text-cream/60">
            <Loader2 className="h-5 w-5 animate-spin" /> Confirming your membership…
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {data && (
          <>
            <span className="grid h-16 w-16 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
              <Check className="h-7 w-7" />
            </span>
            <div className="eyebrow mt-8 text-gold">
              {data.payment_status === "paid" ? "Membership active" : "Payment pending"}
            </div>
            <h1 className="mt-4 font-display text-4xl md:text-5xl">
              {data.first_name ? `Welcome, ${data.first_name}.` : "Welcome to the Members Club."}
            </h1>
            <p className="mt-5 max-w-xl text-cream/70">
              {data.plan_name ?? "Your membership"} is set up
              {data.amount_total != null ? ` at $${(data.amount_total / 100).toFixed(2)} per cycle` : ""}. A receipt is on
              its way to {data.email ?? "your inbox"}. To cancel, call the shop directly.
            </p>
            {data.member_code && (
              <div className="mt-8 rounded-sm border border-gold/40 bg-gold/5 px-8 py-6">
                <div className="text-[10px] uppercase tracking-[0.28em] text-cream/50">Your member code</div>
                <div className="mt-2 font-numeric text-3xl tracking-[0.3em] text-gold">{data.member_code}</div>
                <p className="mt-2 text-xs text-cream/50">Show this at the front desk. We will print your card on your first visit.</p>
              </div>
            )}
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/members-club" className="btn-gold">Back to Members Club</Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
