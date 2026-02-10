-- Default semua user baru jadi Pending sampai di-accept admin
ALTER TABLE public.profiles
ALTER COLUMN payment_active SET DEFAULT false;