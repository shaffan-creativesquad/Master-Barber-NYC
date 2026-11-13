import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BILLING_DAY_CHANGE_AT } from "@/lib/billing-proration";

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin access required.");
}

type Outcome = "swapped" | "skipped" | "failed";

/**
 * One-time Nov 1, 2026 price increase for existing auto-billing members.
 *
 * Square: ACTIVE subscriptions get a SWAP_PLAN action, which Square applies at
 * the start of the next billing cycle — so this must not run before the last
 * old-price charge (Oct 10). PENDING subscriptions (not yet started) are
 * skipped — swap-plan has no billing cycle to apply at — so they must be
 * migrated by running this again after the subscription starts. Already-
 * migrated subscriptions are skipped, so running twice is safe.
 *
 * Stripe (legacy): the subscription item moves to a new price with
 * proration_behavior "none", so it applies from the next invoice.
 */
export const migrateMembershipPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    if (Date.now() < BILLING_DAY_CHANGE_AT.getTime()) {
      throw new Error("The price increase can only be applied on or after November 1, 2026.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getMemberships } = await import("@/lib/site-data");
    const MEMBERSHIPS = getMemberships();
    const sq = await import("@/lib/square.server");

    const runId = crypto.randomUUID();
    const summary: Record<Outcome, number> = { swapped: 0, skipped: 0, failed: 0 };
    const failures: Array<{ membership_id: string; error: string }> = [];

    const log = async (row: {
      membership_id: string; provider: string; old_amount_cents: number | null;
      new_amount_cents: number | null; status: Outcome; error?: string | null;
    }) => {
      summary[row.status] += 1;
      if (row.status === "failed") failures.push({ membership_id: row.membership_id, error: row.error ?? "" });
      await supabaseAdmin.from("price_migration_log").insert({ run_id: runId, ...row, error: row.error ?? null });
    };

    const amountCache = new Map<string, number | null>();
    const variationAmount = async (id: string): Promise<number | null> => {
      if (amountCache.has(id)) return amountCache.get(id)!;
      let amount: number | null = null;
      try {
        const res = await sq.squareFetch<{
          object?: { subscription_plan_variation_data?: { phases?: Array<{ pricing?: { price_money?: { amount?: number } } }> } };
        }>(`/v2/catalog/object/${encodeURIComponent(id)}`);
        amount = res.object?.subscription_plan_variation_data?.phases?.[0]?.pricing?.price_money?.amount ?? null;
      } catch { /* unknown */ }
      amountCache.set(id, amount);
      return amount;
    };
    const variationCache = new Map<string, string>();
    const newVariationFor = async (plan: import("@/lib/site-data").Membership) => {
      if (!variationCache.has(plan.id)) variationCache.set(plan.id, await sq.ensurePlanVariation(plan));
      return variationCache.get(plan.id)!;
    };

    // ---------------- Square ----------------
    const { data: squareRows, error: sqErr } = await supabaseAdmin
      .from("memberships")
      .select("id,plan_id,square_subscription_id")
      .not("square_subscription_id", "is", null);
    if (sqErr) throw new Error(sqErr.message);

    for (const m of squareRows ?? []) {
      const subId = m.square_subscription_id as string;
      const plan = MEMBERSHIPS.find((p) => p.id === m.plan_id);
      let oldAmount: number | null = null;
      try {
        const sub = await sq.getSquareSubscription(subId);
        const status = sub.status.toUpperCase();
        if (status !== "ACTIVE" && status !== "PENDING") {
          await log({ membership_id: m.id, provider: "square", old_amount_cents: null, new_amount_cents: null, status: "skipped", error: `Subscription is ${status}` });
          continue;
        }
        if (!plan) throw new Error(`Unknown plan id "${m.plan_id}"`);
        const newVar = await newVariationFor(plan);
        oldAmount = sub.plan_variation_id ? await variationAmount(sub.plan_variation_id) : null;

        if (sub.plan_variation_id === newVar || oldAmount === plan.amountCents) {
          await log({ membership_id: m.id, provider: "square", old_amount_cents: oldAmount, new_amount_cents: plan.amountCents, status: "skipped", error: "Already on the new price" });
          continue;
        }
        const pending = await sq.pendingSwapTargets(subId).catch(() => [] as string[]);
        if (pending.includes(newVar)) {
          await log({ membership_id: m.id, provider: "square", old_amount_cents: oldAmount, new_amount_cents: plan.amountCents, status: "skipped", error: "Swap already scheduled" });
          continue;
        }

        if (status === "PENDING") {
          await log({ membership_id: m.id, provider: "square", old_amount_cents: oldAmount, new_amount_cents: plan.amountCents, status: "skipped", error: "Not started yet — run again after it starts" });
          continue;
        }
        await sq.swapSquarePlan(subId, newVar);
        await log({ membership_id: m.id, provider: "square", old_amount_cents: oldAmount, new_amount_cents: plan.amountCents, status: "swapped" });
      } catch (e) {
        await log({ membership_id: m.id, provider: "square", old_amount_cents: oldAmount, new_amount_cents: plan?.amountCents ?? null, status: "failed", error: e instanceof Error ? e.message : String(e) });
      }
    }

    // ---------------- Stripe (legacy) ----------------
    const { data: stripeRows } = await supabaseAdmin
      .from("memberships")
      .select("id,plan_id,stripe_subscription_id")
      .not("stripe_subscription_id", "is", null);
    if ((stripeRows ?? []).length > 0 && process.env["STRIPE_SECRET_KEY"]) {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]);
      for (const m of stripeRows ?? []) {
        const plan = MEMBERSHIPS.find((p) => p.id === m.plan_id);
        let oldAmount: number | null = null;
        try {
          const sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id as string);
          if (!["active", "trialing", "past_due"].includes(sub.status)) {
            await log({ membership_id: m.id, provider: "stripe", old_amount_cents: null, new_amount_cents: null, status: "skipped", error: `Subscription is ${sub.status}` });
            continue;
          }
          if (!plan) throw new Error(`Unknown plan id "${m.plan_id}"`);
          const item = sub.items.data[0];
          if (!item) throw new Error("Subscription has no items.");
          oldAmount = item.price.unit_amount ?? null;
          if (oldAmount === plan.amountCents) {
            await log({ membership_id: m.id, provider: "stripe", old_amount_cents: oldAmount, new_amount_cents: plan.amountCents, status: "skipped", error: "Already on the new price" });
            continue;
          }
          const product = typeof item.price.product === "string" ? item.price.product : item.price.product.id;
          const price = await stripe.prices.create({
            currency: "usd",
            unit_amount: plan.amountCents,
            product,
            recurring: { interval: plan.billingInterval },
          }, { idempotencyKey: `nov1-price-${product}-${plan.amountCents}-${plan.billingInterval}` });
          await stripe.subscriptions.update(sub.id, {
            items: [{ id: item.id, price: price.id }],
            proration_behavior: "none",
          });
          await log({ membership_id: m.id, provider: "stripe", old_amount_cents: oldAmount, new_amount_cents: plan.amountCents, status: "swapped" });
        } catch (e) {
          await log({ membership_id: m.id, provider: "stripe", old_amount_cents: oldAmount, new_amount_cents: plan?.amountCents ?? null, status: "failed", error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    return { run_id: runId, ...summary, failures };
  });
