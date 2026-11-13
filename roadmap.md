# Standalone refund action
- [x] Add admin-only "Refund payment" beside Cancel: lists recent card payments with duplicate tags, full/partial, required reason.
- [x] Server `refundPayment` + `listMemberPayments` reusing refund helpers; deterministic `refund-only-` idempotency keys; no membership/access changes.
- [x] Migration 0021: multiple refunds per membership (`kind`), `payment_refunded` check-in result; webhook updates only the matching refund row.
- [x] Refund history labels "Refund (membership kept)" vs "Refund + cancel"; unit tests; no real Square calls.

# Monitoring payment fixes
- [x] Isolate cancellation refund reads and updates from standalone refunds; add mocked regression coverage.
- [x] Record and return tax-inclusive appointment fee charges; preserve configured pre-tax fee_cents; add mocked regression coverage.
- [x] Run affected tests and check preview diagnostics; resolve confirmed findings.
