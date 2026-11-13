/**
 * Charges a member's recurring monthly tip to their card on file right after
 * Square collects the membership payment. Tips are never taxed and run as a
 * separate Square payment so tax reporting on the membership stays clean.
 */
export async function chargeMembershipTip(subscriptionId: string, invoiceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: m } = await supabaseAdmin
    .from("memberships")
    .select("id, tip_cents, square_card_id, square_customer_id, tier")
    .eq("square_subscription_id", subscriptionId)
    .maybeSingle();
  if (!m || !m.tip_cents || m.tip_cents <= 0 || !m.square_card_id) return null;
  const { chargeSquare } = await import("@/lib/square.server");
  return chargeSquare({
    sourceId: m.square_card_id,
    customerId: m.square_customer_id,
    amountCents: m.tip_cents,
    note: `Monthly membership tip (${m.tier ?? "membership"})`,
    idempotencyKey: `mtip-${invoiceId}`.slice(0, 45),
  });
}
