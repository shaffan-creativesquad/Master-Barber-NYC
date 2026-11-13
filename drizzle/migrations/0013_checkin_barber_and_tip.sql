ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tip_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_payment_method text,
  ADD COLUMN IF NOT EXISTS tip_payment_id text;

ALTER TABLE public.checkins
  DROP CONSTRAINT IF EXISTS checkins_tip_payment_method_check;

ALTER TABLE public.checkins
  ADD CONSTRAINT checkins_tip_payment_method_check
  CHECK (tip_payment_method IS NULL OR tip_payment_method IN ('card','cash'));

CREATE INDEX IF NOT EXISTS checkins_barber_id_idx ON public.checkins (barber_id);