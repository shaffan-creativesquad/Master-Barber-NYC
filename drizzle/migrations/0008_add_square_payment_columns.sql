ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS square_customer_id text,
  ADD COLUMN IF NOT EXISTS square_card_id text;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS square_customer_id text,
  ADD COLUMN IF NOT EXISTS square_subscription_id text,
  ADD COLUMN IF NOT EXISTS square_card_id text;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS square_customer_id text,
  ADD COLUMN IF NOT EXISTS square_card_id text;

CREATE INDEX IF NOT EXISTS memberships_square_subscription_id_idx
  ON public.memberships (square_subscription_id);
CREATE INDEX IF NOT EXISTS customers_square_customer_id_idx
  ON public.customers (square_customer_id);