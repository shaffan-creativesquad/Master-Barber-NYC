<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Billing day is stored per membership (memberships.billing_day); new memberships use billingDayForNewMembership() from src/lib/billing-proration.ts and existing ones never change day. Why: legacy rows may hold other values.
- Signup billing (online and staff auto-billing) goes through startMembershipBilling() in src/lib/square.server.ts, with amounts and New York calendar dates from joinChargeQuote(); Square alone charges the first invoice, verified before creating a membership, and first-invoice tips reuse webhook idempotency keys. Why: prevent duplicate signup charges and early access before payment.
- Membership prices come from getMemberships()/isNewPricing() in src/lib/site-data.ts, evaluated at request time; never a static price list. Why: Nov 1, 2026 price switch happens automatically without a redeploy.
- Canceling a membership (admin Cancel, status set to canceled in Edit, member deletion, duplicate removal) goes through cancelMembershipSubscriptions() in src/lib/members.functions.ts, which uses cancelSquareSubscriptionConfirmed()/cancelStripeSubscriptionConfirmed and throws unless the provider confirms — so the database is never marked canceled while Square keeps billing. A canceled membership stays check-in valid until current_period_end; squareSubscriptionStatus() in src/lib/square-membership-sync.server.ts treats a Square canceled_date as canceled even while Square still reports ACTIVE. Why: Square only sets canceled_date at cancellation and keeps ACTIVE until period end, and orphaned subscriptions would keep charging cards.
- Optional cancellation refunds use server-verified membership payment provenance, remaining-amount validation, hashed deterministic intent keys, and a unique membership_refunds reservation before requesting Square refunds; accepted refunds persist refund_access_ended_at and sync must preserve it. Why: retries must not double-refund and subscription webhooks must not restore refunded access.
- Standalone "Refund payment" (admin-only refundPayment in src/lib/members.functions.ts) refunds one verified card payment without canceling: it must never touch membership status, current_period_end, needs_review, or the Square subscription. membership_refunds allows multiple rows per membership, distinguished by kind ('cancel' | 'standalone'); the refund webhook ends access only for 'cancel' rows, and standalone keys use the refund-only- prefix. Why: refunding an accidental duplicate must not stop billing or cut off access.
- Unit tests use vitest.config.ts without the app's RPC transforms and mock payment/persistence boundaries when exercising server handlers. Why: verify business outcomes without real financial operations.
