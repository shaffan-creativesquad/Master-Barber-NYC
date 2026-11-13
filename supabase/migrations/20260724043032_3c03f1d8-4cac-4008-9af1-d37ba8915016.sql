DROP POLICY IF EXISTS "public reads settings" ON public.business_settings;
REVOKE SELECT ON public.business_settings FROM anon;