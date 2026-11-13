ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS expiration_edit_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_expiration_edit_at timestamptz;