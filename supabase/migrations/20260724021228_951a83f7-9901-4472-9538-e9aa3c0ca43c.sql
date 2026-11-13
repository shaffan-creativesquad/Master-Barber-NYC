DROP POLICY IF EXISTS "public reads schedules" ON public.barber_schedules;
DROP POLICY IF EXISTS "public reads breaks" ON public.barber_breaks;
DROP POLICY IF EXISTS "public reads time off" ON public.barber_time_off;

CREATE POLICY "staff reads schedules" ON public.barber_schedules FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff'));
CREATE POLICY "staff reads breaks" ON public.barber_breaks FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff'));
CREATE POLICY "staff reads time off" ON public.barber_time_off FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff'));

REVOKE SELECT ON public.barber_schedules FROM anon;
REVOKE SELECT ON public.barber_breaks FROM anon;
REVOKE SELECT ON public.barber_time_off FROM anon;