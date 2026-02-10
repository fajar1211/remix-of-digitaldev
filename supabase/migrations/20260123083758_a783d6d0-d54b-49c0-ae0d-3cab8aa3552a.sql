-- New users should start as nonactive until an admin activates them
ALTER TABLE public.profiles
  ALTER COLUMN payment_active SET DEFAULT false;