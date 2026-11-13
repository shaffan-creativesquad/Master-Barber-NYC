
UPDATE public.locations SET name='Park Slope', address='169 7th Ave, Brooklyn, NY 11215', phone='(347) 689-9032', sort_order=1 WHERE id='0cef8070-595d-4bc5-93d3-5859d7b15348';
UPDATE public.locations SET name='Downtown', address='66 Bond St, Brooklyn, NY 11217', phone='(347) 457-6777', sort_order=2 WHERE id='d52cb9dd-9eb7-4a12-af67-08cf4e62d953';

UPDATE public.services SET duration_min=30 WHERE name IN ('Regular Haircut','Skin Fade','Scissor / Layer Cut','Crew Cut','Long Hair','Boys Haircut (Under 12)','Senior Citizen Cut');
UPDATE public.services SET duration_min=45 WHERE name IN ('Cut + Beard Trim','Cut + Shave');
UPDATE public.services SET price_cents=3500 WHERE name='Crew Cut';

INSERT INTO public.services (name, price_cents, duration_min, buffer_min, active)
SELECT 'Buzz Cut', 3500, 30, 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name='Buzz Cut');
