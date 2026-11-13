
-- Recreate policies referencing has_role after moving it
-- Drop all policies that call public.has_role, move the function, recreate them.

-- Drop dependent policies
DROP POLICY IF EXISTS "user sees own roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin manages locations" ON public.locations;
DROP POLICY IF EXISTS "admin manages hours" ON public.location_hours;
DROP POLICY IF EXISTS "admin manages holidays" ON public.holidays;
DROP POLICY IF EXISTS "admin manages services" ON public.services;
DROP POLICY IF EXISTS "admin manages barbers" ON public.barbers;
DROP POLICY IF EXISTS "admin manages barber_locations" ON public.barber_locations;
DROP POLICY IF EXISTS "admin manages barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "admin manages schedules" ON public.barber_schedules;
DROP POLICY IF EXISTS "admin manages breaks" ON public.barber_breaks;
DROP POLICY IF EXISTS "admin manages time off" ON public.barber_time_off;
DROP POLICY IF EXISTS "admin reads customers" ON public.customers;
DROP POLICY IF EXISTS "admin manages customers" ON public.customers;
DROP POLICY IF EXISTS "admin reads appointments" ON public.appointments;
DROP POLICY IF EXISTS "admin manages appointments" ON public.appointments;
DROP POLICY IF EXISTS "admin manages settings" ON public.business_settings;

DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO authenticated, service_role;

-- Recreate policies
CREATE POLICY "user sees own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));

CREATE POLICY "admin manages locations" ON public.locations FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages hours" ON public.location_hours FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages holidays" ON public.holidays FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages services" ON public.services FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages barbers" ON public.barbers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages barber_locations" ON public.barber_locations FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages barber_services" ON public.barber_services FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages schedules" ON public.barber_schedules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages breaks" ON public.barber_breaks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages time off" ON public.barber_time_off FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin reads customers" ON public.customers FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff'));
CREATE POLICY "admin manages customers" ON public.customers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin reads appointments" ON public.appointments FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff'));
CREATE POLICY "admin manages appointments" ON public.appointments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages settings" ON public.business_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

-- Public function to allow a signed-in user to check their own admin status without exposing the definer
CREATE OR REPLACE FUNCTION public.current_user_is_admin() RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
