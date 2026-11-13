UPDATE public.location_hours SET close_time = '19:00:00' WHERE weekday = 0 AND closed = false;
UPDATE public.services SET name = 'Buzz / Crew Cut' WHERE id = '8b2b9703-ea2d-471f-b2ed-a11edd4af0ea';
UPDATE public.services SET active = false WHERE id = 'da4f4221-1b81-4a8a-b1bb-0d39d344ec99';