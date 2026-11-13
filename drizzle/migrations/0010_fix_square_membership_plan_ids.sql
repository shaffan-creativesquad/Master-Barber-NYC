UPDATE public.memberships
SET plan_id = 'silver-monthly', tier = 'Silver'
WHERE source = 'square' AND plan_id !~ '-';