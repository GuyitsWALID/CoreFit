ALTER TABLE public.packages
ADD COLUMN IF NOT EXISTS is_coupon boolean NOT NULL DEFAULT false;
