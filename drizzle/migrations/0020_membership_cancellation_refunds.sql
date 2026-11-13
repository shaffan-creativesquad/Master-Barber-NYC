ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS last_card_payment_id text;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS refund_access_ended_at timestamptz;
CREATE TABLE public.membership_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 membership_id uuid NOT NULL UNIQUE,
 customer_id uuid NOT NULL,
 square_payment_id text NOT NULL,
 square_refund_id text UNIQUE,
 idempotency_key text NOT NULL UNIQUE,
 amount_cents integer NOT NULL CHECK (amount_cents > 0),
 status text NOT NULL CHECK (status IN ('REQUESTED','PENDING','COMPLETED','FAILED','REJECTED')),
 reason text NOT NULL,
 staff_user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_refunds TO authenticated;
GRANT ALL ON public.membership_refunds TO service_role;
ALTER TABLE public.membership_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage membership refunds" ON public.membership_refunds FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));