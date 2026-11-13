# Switch payments from Stripe to Square

The shop already runs Square in-store, so memberships and booking card-on-file move to the same Square account. This is a rebuild of the payment layer, not a key swap — Square has a different card form, a different subscription model, and different webhooks.

## What the client needs to provide

From their Square Developer dashboard (developer.squareup.com), for their existing Square account:

- Application ID (public, safe in code)
- Location ID (the shop's Square location, public)
- Access Token (secret)
- Webhook Signature Key (secret)

Sandbox values first so we can test end to end, then production values before go-live.

## How Square maps to what we built

| Today (Stripe) | On Square |
|---|---|
| Stripe Elements card form | Square Web Payments SDK card form |
| Customer + PaymentMethod | Square Customer + Card on File |
| Subscription + billing cycle anchor | Subscription with `monthly_billing_anchor_date = 10` |
| Full first charge, then anchor shift | One-off Payment for the first full month, then subscription starting the next 10th |
| SetupIntent for booking no-show card | Card on File stored against the Square customer |
| Webhook events | `subscription.created/updated`, `invoice.payment_made`, `payment.updated` |

Square does not prorate mid-cycle the way Stripe does. The current behaviour already charges full price on day one and shifts the cycle to the 10th, so on Square the first month is a straight one-time payment and the recurring subscription begins on the following 10th. The checkout copy gets updated to say exactly that.

## Work items

1. **Database** — add `square_customer_id`, `square_subscription_id`, `square_card_id` to `customers` / `memberships`. Keep the Stripe columns so existing records and history stay intact.
2. **Server layer** — new `src/lib/square.server.ts` (Square API client, signed webhook verification) and `square.functions.ts` replacing `stripe.functions.ts`. New `square-membership-sync.server.ts` mirroring the current single idempotent sync path.
3. **Subscription catalog** — create Square subscription plans matching the current membership tiers and prices, anchored to the 10th.
4. **Checkout UI** — `members-checkout.tsx` swaps Stripe Elements for the Square card form; same steps, same styling, updated proration wording.
5. **Booking card-on-file** — `book.index.tsx` stores a Square card on file instead of a Stripe SetupIntent; cancellation / no-show fees charge that card.
6. **Admin + validator** — "Set up auto-billing", cash settlement, and the member detail popup point at Square. Manual/cash flows and receipt photos are unchanged.
7. **Webhook** — new `src/routes/api/public/square-webhook.ts` with signature verification; the Stripe webhook route stays until the last Stripe subscription is retired.
8. **Migration of live members** — right now there is exactly one real Stripe-linked member and it is a test subscription, so nothing meaningful has to be migrated. Everything else is manual/imported and unaffected.

## Testing

Square sandbox card numbers, full run through: new card signup, renewal on the 10th, cash renewal with receipt photo, cancellation fee charge, webhook replay.

## Notes

- Stripe code is removed only after Square passes the full sandbox run, so there is always a working path.
- Nothing goes live until the client supplies production Square credentials and we do a small real charge and refund.
