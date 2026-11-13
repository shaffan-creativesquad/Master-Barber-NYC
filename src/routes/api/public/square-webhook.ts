import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

type SquareEvent = {
  type?: string;
  data?: { type?: string; id?: string; object?: Record<string, unknown> };
};

function subscriptionIdFrom(event: SquareEvent): string | null {
  const object = event.data?.object ?? {};
  const sub = object["subscription"] as { id?: string } | undefined;
  if (sub?.id) return sub.id;
  const invoice = object["invoice"] as { subscription_id?: string } | undefined;
  if (invoice?.subscription_id) return invoice.subscription_id;
  if (event.data?.type === "subscription" && event.data.id) return event.data.id;
  return null;
}

export const Route = createFileRoute("/api/public/square-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signatureKey = process.env["SQUARE_WEBHOOK_SIGNATURE_KEY"];
        if (!signatureKey) return new Response("Webhook not configured", { status: 500 });

        const signature = request.headers.get("x-square-hmacsha256-signature");
        if (!signature) return new Response("Missing signature", { status: 401 });

        const rawBody = await request.text();
        const { verifySquareSignature } = await import("@/lib/square.server");

        const configuredUrl = process.env["SQUARE_WEBHOOK_URL"];
        const candidates = configuredUrl ? [configuredUrl, request.url] : [request.url];
        let valid = false;
        for (const notificationUrl of candidates) {
          if (await verifySquareSignature({ notificationUrl, rawBody, signature, signatureKey })) {
            valid = true;
            break;
          }
        }
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let event: SquareEvent;
        try {
          event = JSON.parse(rawBody) as SquareEvent;
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        if (event.type === "refund.created" || event.type === "refund.updated") {
          const parsed = z.object({
            id: z.string().min(1).max(192), payment_id: z.string().min(1).max(192),
            status: z.enum(["PENDING", "COMPLETED", "FAILED", "REJECTED"]),
            amount_money: z.object({ amount: z.number().int().positive(), currency: z.literal("USD") }),
          }).safeParse(event.data?.object?.["refund"]);
          if (!parsed.success) return new Response("Invalid refund payload", { status: 400 });
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { squareFetch } = await import("@/lib/square.server");
            // Re-fetch the latest status so delayed/replayed events cannot regress it.
            const latest = await squareFetch<{ refund?: typeof parsed.data }>(`/v2/refunds/${encodeURIComponent(parsed.data.id)}`);
            const refund = latest.refund;
            if (!refund || refund.payment_id !== parsed.data.payment_id) throw new Error("Refund could not be verified.");
            // A membership can have several refund rows now (standalone refunds keep
            // the membership active), so match the exact payment + amount and update
            // only that row.
            const { data: recorded, error: readError } = await supabaseAdmin.from("membership_refunds")
              .select("id,membership_id,kind,created_at,square_refund_id").eq("square_payment_id", refund.payment_id)
              .eq("amount_cents", refund.amount_money.amount).order("created_at", { ascending: false }).limit(1);
            if (readError) throw new Error(readError.message);
            const row = recorded?.[0];
            if (!row) return new Response("ok");
            if (row.square_refund_id && row.square_refund_id !== refund.id) return new Response("ok");
            const { error } = await supabaseAdmin.from("membership_refunds").update({ status: refund.status, square_refund_id: refund.id })
              .eq("id", row.id);
            if (error) throw new Error(error.message);
            // Standalone refunds ("Refund payment") never change membership status or access.
            if (row.kind !== "standalone" && ["PENDING", "COMPLETED"].includes(refund.status)) {
              const { error: accessError } = await supabaseAdmin.from("memberships").update({
                status: "canceled", current_period_end: row.created_at, refund_access_ended_at: row.created_at,
              }).eq("id", row.membership_id).eq("status", "canceled");
              if (accessError) throw new Error(accessError.message);
            }
          } catch (e) {
            console.error("[square-webhook] refund_update_failed", e);
            return new Response("Refund update failed", { status: 500 });
          }
          return new Response("ok");
        }

        const handled = new Set([
          "subscription.created",
          "subscription.updated",
          "invoice.payment_made",
          "invoice.scheduled_charge_failed",
          "invoice.canceled",
        ]);
        if (!event.type || !handled.has(event.type)) return new Response("ok");

        const subscriptionId = subscriptionIdFrom(event);
        if (!subscriptionId) return new Response("ok");

        try {
          const { syncSquareMembership } = await import("@/lib/square-membership-sync.server");
          await syncSquareMembership(subscriptionId);
          if (event.type === "invoice.payment_made") {
            const invoice = (event.data?.object?.["invoice"] ?? {}) as { id?: string };
            const invoiceId = invoice.id ?? event.data?.id;
            if (invoiceId) {
              const { chargeMembershipTip } = await import("@/lib/membership-tip.server");
              await chargeMembershipTip(subscriptionId, invoiceId).catch((err) =>
                console.error("Monthly membership tip charge failed", subscriptionId, err),
              );
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
