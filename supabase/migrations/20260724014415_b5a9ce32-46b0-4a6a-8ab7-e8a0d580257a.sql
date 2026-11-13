
-- ============ EXTENSIONS / HELPERS ============
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- ============ ROLES ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user sees own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ LOCATIONS ============
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.locations TO anon, authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads active locations" ON public.locations FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "admin manages locations" ON public.locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER locations_updated BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- weekday 0=Sun..6=Sat
CREATE TABLE public.location_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time TIME,
  close_time TIME,
  closed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(location_id, weekday)
);
GRANT SELECT ON public.location_hours TO anon, authenticated;
GRANT ALL ON public.location_hours TO service_role;
ALTER TABLE public.location_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads hours" ON public.location_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages hours" ON public.location_hours FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT
);
GRANT SELECT ON public.holidays TO anon, authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads holidays" ON public.holidays FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages holidays" ON public.holidays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SERVICES ============
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL,
  duration_min INT NOT NULL,
  category TEXT NOT NULL DEFAULT 'haircut',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads active services" ON public.services FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "admin manages services" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BARBERS ============
CREATE TABLE public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  specialty TEXT,
  experience_years INT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.barbers TO anon, authenticated;
GRANT ALL ON public.barbers TO service_role;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads active barbers" ON public.barbers FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "admin manages barbers" ON public.barbers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER barbers_updated BEFORE UPDATE ON public.barbers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.barber_locations (
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, location_id)
);
GRANT SELECT ON public.barber_locations TO anon, authenticated;
GRANT ALL ON public.barber_locations TO service_role;
ALTER TABLE public.barber_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads barber_locations" ON public.barber_locations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages barber_locations" ON public.barber_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.barber_services (
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, service_id)
);
GRANT SELECT ON public.barber_services TO anon, authenticated;
GRANT ALL ON public.barber_services TO service_role;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads barber_services" ON public.barber_services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages barber_services" ON public.barber_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.barber_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);
GRANT SELECT ON public.barber_schedules TO anon, authenticated;
GRANT ALL ON public.barber_schedules TO service_role;
ALTER TABLE public.barber_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads schedules" ON public.barber_schedules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages schedules" ON public.barber_schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.barber_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  weekday INT CHECK (weekday BETWEEN 0 AND 6),
  date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);
GRANT SELECT ON public.barber_breaks TO anon, authenticated;
GRANT ALL ON public.barber_breaks TO service_role;
ALTER TABLE public.barber_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads breaks" ON public.barber_breaks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages breaks" ON public.barber_breaks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.barber_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT
);
GRANT SELECT ON public.barber_time_off TO anon, authenticated;
GRANT ALL ON public.barber_time_off TO service_role;
ALTER TABLE public.barber_time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads time off" ON public.barber_time_off FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages time off" ON public.barber_time_off FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customers_email_idx ON public.customers(lower(email));
GRANT ALL ON public.customers TO service_role;
GRANT SELECT ON public.customers TO authenticated;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads customers" ON public.customers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin manages customers" ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ APPOINTMENTS ============
DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM ('pending','confirmed','checked_in','completed','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  barber_id UUID NOT NULL REFERENCES public.barbers(id),
  service_id UUID NOT NULL REFERENCES public.services(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  price_cents INT NOT NULL,
  duration_min INT NOT NULL,
  stripe_payment_method_id TEXT,
  stripe_setup_intent_id TEXT,
  cancellation_fee_charged_cents INT NOT NULL DEFAULT 0,
  no_show_fee_charged_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ends_after_starts CHECK (ends_at > starts_at)
);
CREATE INDEX appt_barber_time_idx ON public.appointments(barber_id, starts_at);
CREATE INDEX appt_location_time_idx ON public.appointments(location_id, starts_at);
-- Prevent double booking for a barber (unless cancelled/no_show)
ALTER TABLE public.appointments
  ADD CONSTRAINT appt_no_overlap EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled','no_show'));

GRANT SELECT ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads appointments" ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin manages appointments" ON public.appointments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER appt_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BUSINESS SETTINGS ============
CREATE TABLE public.business_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  require_card BOOLEAN NOT NULL DEFAULT true,
  require_deposit BOOLEAN NOT NULL DEFAULT false,
  deposit_cents INT NOT NULL DEFAULT 0,
  cancellation_window_hours INT NOT NULL DEFAULT 24,
  cancellation_fee_cents INT NOT NULL DEFAULT 2000,
  no_show_fee_cents INT NOT NULL DEFAULT 4000,
  auto_confirm BOOLEAN NOT NULL DEFAULT true,
  max_days_ahead INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_settings TO anon, authenticated;
GRANT ALL ON public.business_settings TO service_role;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads settings" ON public.business_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages settings" ON public.business_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER settings_updated BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.business_settings (id) VALUES (true);

-- ============ SEED LOCATIONS + HOURS ============
WITH ins AS (
  INSERT INTO public.locations (name, address, phone, sort_order) VALUES
    ('Downtown Brooklyn','1247 Bedford Avenue, Brooklyn, NY 11216','(347) 555-0142',1),
    ('Park Slope Brooklyn','512 5th Avenue, Brooklyn, NY 11215','(347) 555-0142',2)
  RETURNING id, name
)
INSERT INTO public.location_hours (location_id, weekday, open_time, close_time, closed)
SELECT id, w.weekday, w.open_time, w.close_time, w.closed
FROM ins
CROSS JOIN LATERAL (VALUES
  (0, TIME '09:00', CASE WHEN ins.name='Park Slope Brooklyn' THEN TIME '18:00' ELSE TIME '17:00' END, false),
  (1, TIME '09:00', TIME '19:00', false),
  (2, TIME '09:00', TIME '19:00', false),
  (3, TIME '09:00', TIME '19:00', false),
  (4, TIME '09:00', TIME '19:00', false),
  (5, TIME '09:00', TIME '19:00', false),
  (6, NULL, NULL, true)
) AS w(weekday, open_time, close_time, closed);

-- ============ SEED SERVICES ============
INSERT INTO public.services (name, description, price_cents, duration_min, category, sort_order) VALUES
  ('Regular Haircut','Classic scissor and clipper cut, tailored to your look and finished clean.',4200,45,'haircut',1),
  ('Skin Fade','A blade-close fade blended seamlessly into a custom top length.',4200,45,'haircut',2),
  ('Scissor / Layer Cut','All-scissor cut with soft layers for texture, movement and length control.',4500,50,'haircut',3),
  ('Crew Cut','Sharp, low-maintenance classic. Precise on the sides, clean on top.',3000,30,'haircut',4),
  ('Long Hair','Detail work for longer lengths — shape, weight and finish that grows out right.',5000,65,'haircut',5),
  ('Boys Haircut (Under 12)','Patient, careful work for young clients. Same craft, calmer chair.',3500,30,'haircut',6),
  ('Senior Citizen Cut','A refined classic cut with the same unhurried attention.',3000,40,'haircut',7),
  ('Cut + Beard Trim','The full reset. Signature cut paired with a shaped, lined beard.',6000,60,'haircut',8),
  ('Cut + Shave','Precision haircut followed by a traditional hot towel straight razor shave.',7000,75,'haircut',9),
  ('Beard Trim with Razor','Shape, line-up and steam. Walk out looking intentional, not overgrown.',3000,30,'razor',10),
  ('Shape Up with Razor','A clean line, sharp corners and a fresh perimeter between visits.',2000,20,'razor',11),
  ('Hot Towel Shave','Warm lather, hot towels, straight razor, cold finish. Old-school ritual.',4000,45,'razor',12),
  ('Head Razor Shave','Full razor shave for a smooth, polished head — done with unhurried care.',4000,40,'razor',13);
