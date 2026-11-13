ALTER TABLE public.membership_refunds DROP CONSTRAINT IF EXISTS membership_refunds_membership_id_key;
ALTER TABLE public.membership_refunds ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'cancel';
ALTER TABLE public.membership_refunds ADD CONSTRAINT membership_refunds_kind_check CHECK (kind IN ('cancel','standalone'));
ALTER TABLE public.checkins DROP CONSTRAINT checkins_result_check;
ALTER TABLE public.checkins ADD CONSTRAINT checkins_result_check CHECK (result = ANY (ARRAY['approved','denied','renewed','member_deleted','expiration_override','duplicate_subscription','membership_removed','membership_canceled','plan_change','payment_refunded']));