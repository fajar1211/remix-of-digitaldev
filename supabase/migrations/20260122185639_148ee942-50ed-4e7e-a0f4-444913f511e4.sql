ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payment_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_payment_active ON public.profiles (payment_active);