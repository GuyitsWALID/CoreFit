INSERT INTO public.roles (name, description)
SELECT 'manager', 'Gym manager with operational access excluding reports, settings, and destructive member/staff deletion.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE name = 'manager'
);
