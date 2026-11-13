CREATE TYPE public.membership_status AS ENUM ('active','past_due','canceled','incomplete');

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS member_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS customers_member_code_key ON public.customers (member_code) WHERE member_code IS NOT NULL;

CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  status public.membership_status NOT NULL DEFAULT 'incomplete',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  source TEXT NOT NULL DEFAULT 'stripe' CHECK (source IN ('stripe','manual')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX memberships_customer_idx ON public.memberships (customer_id, created_at DESC);

GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff reads memberships" ON public.memberships FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "admin manages memberships" ON public.memberships FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER memberships_updated BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  matched_via TEXT NOT NULL CHECK (matched_via IN ('member_code','phone','manual_override')),
  result TEXT NOT NULL CHECK (result IN ('approved','denied')),
  reason TEXT,
  staff_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX checkins_customer_idx ON public.checkins (customer_id, created_at DESC);

GRANT SELECT ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff reads checkins" ON public.checkins FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'staff'::app_role));