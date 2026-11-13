INSERT INTO public.services (name, description, price_cents, duration_min, buffer_min, category, active, sort_order)
SELECT 'First Haircut $20', 'New-client special. Any signature haircut for $20 on your first visit.', 2000, 30, 0, 'haircut', true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'First Haircut $20');