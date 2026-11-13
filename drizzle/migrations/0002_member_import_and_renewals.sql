ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS imported_from TEXT;

ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS last_payment_method TEXT;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS last_renewed_at TIMESTAMPTZ;

ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_source_check;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_source_check CHECK (source IN ('stripe','manual','imported'));

ALTER TABLE public.memberships ADD CONSTRAINT memberships_last_payment_method_check CHECK (last_payment_method IS NULL OR last_payment_method IN ('cash','card'));

CREATE INDEX IF NOT EXISTS memberships_needs_review_idx ON public.memberships (needs_review, current_period_end);

ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS checkins_matched_via_check;
ALTER TABLE public.checkins ADD CONSTRAINT checkins_matched_via_check CHECK (matched_via IN ('member_code','phone','manual_override','renewal'));

ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS checkins_result_check;
ALTER TABLE public.checkins ADD CONSTRAINT checkins_result_check CHECK (result IN ('approved','denied','renewed'));

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique_idx ON public.customers (lower(email));