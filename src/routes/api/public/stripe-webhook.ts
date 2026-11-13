import { createFileRoute } from "@tanstack/react-router";

type SubLike = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  items?: { data?: Array<{ current_period_end?: number }> };
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
};

function mapStatus(s: string): "active" | "past_due" | "canceled" | "incomplete" {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid") return "past_due";
  if (s === "canceled" || s === "incomplete_expired") return "canceled";
  return "incomplete";
}

async function syncSubscription(sub: SubLike, stripeKey: string) {
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey);
  const { syncStripeMembership } = await import("@/lib/stripe-membership-sync.server");
  await syncStripeMembership(stripe, sub.id);
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const stripeKey = process.env["STRIPE_SECRET_KEY"];
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!stripeKey || !secret) return new Response("Webhook not configured", { status: 500 });

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 401 });
        const body = await request.text();

        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(stripeKey);

        let event: { type: string; data: { object: unknown } };
        try {
          event = (await stripe.webhooks.constructEventAsync(body, signature, secret)) as unknown as typeof event;
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          if (
            event.type === "customer.subscription.created" ||
            event.type === "customer.subscription.updated" ||
            event.type === "customer.subscription.deleted"
          ) {
            await syncSubscription(event.data.object as SubLike, stripeKey);
          } else if (event.type === "invoice.paid") {
            const inv = event.data.object as { subscription?: string | null; parent?: { subscription_details?: { subscription?: string } } };
            const subId = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
            if (subId) {
              const billingReason = (event.data.object as { billing_reason?: string }).billing_reason;
              // First full-price invoice is paid: now move the renewal date to the 10th.
              if (billingReason === "subscription_create") {
                const { shiftAnchorToTenth } = await import("@/lib/billing-anchor.server");
                try { await shiftAnchorToTenth(stripe, subId); } catch { /* best-effort */ }
              }
              const sub = (await stripe.subscriptions.retrieve(subId)) as unknown as SubLike;
              await syncSubscription(sub, stripeKey);
            }
          }
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "Webhook error", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
