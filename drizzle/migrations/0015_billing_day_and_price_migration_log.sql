ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS billing_day smallint NOT NULL DEFAULT 10;
UPDATE public.memberships SET billing_day = 10 WHERE billing_day IS DISTINCT FROM 10;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_billing_day_check CHECK (billing_day IN (1, 10));

CREATE TABLE public.price_migration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  provider text NOT NULL,
  old_amount_cents integer,
  new_amount_cents integer,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.price_migration_log TO authenticated;
GRANT ALL ON public.price_migration_log TO service_role;
ALTER TABLE public.price_migration_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads price migration log" ON public.price_migration_log
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));