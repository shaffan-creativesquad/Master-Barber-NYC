# Stop the second charge a few days after signup

## The problem (confirmed)

When someone joins, they are charged the full plan price right away. The recurring
billing is then set to start on the very next 10th of the month. Someone who joins
on the 8th pays the full price again two days later, with no credit for the days
they already paid. For yearly plans, the second charge is a full year.

This affects new online signups and the staff "start auto-billing" action.

## Decision needed

Two reasonable ways to handle it — pick one:

**Option A — First charge covers the days until the 10th (prorated join)**
The member pays only for the days between joining and the 10th, then the normal
full price every 10th after that. Simple, no gap, the member never pays twice.
Smaller first payment.

**Option B — First charge is the full price, recurring starts the following 10th**
The member pays the full price at signup, and that payment covers them through the
next 10th plus a full cycle. Recurring billing starts one 10th later than today's
behaviour. Larger first payment, no double charge.

Option A is the closer match to what the checkout screen already tells people.

## Work involved

- Compute the first charge amount and the recurring start date in one shared helper
  so signup and the staff flow behave identically.
- Use that helper in the online signup flow and in the staff-started auto-billing.
- Set the member's renewal date to the date their payment actually covers, instead
  of the subscription start date, so the account page and check-in show the right date.
- Update the checkout wording to state the exact first amount and the next billing date.
- Handle yearly plans with the same rule.
- Verify in the Square sandbox with a join date a few days before the 10th.

No changes to existing members' current billing dates.
