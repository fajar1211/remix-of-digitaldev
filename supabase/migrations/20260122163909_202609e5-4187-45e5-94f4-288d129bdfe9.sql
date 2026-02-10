-- Create promos table for order promo codes
create table if not exists public.order_promos (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  promo_name text not null,
  event_name text not null default '',
  description text not null default '',
  status text not null default 'draft',
  discount_type text not null default 'percentage',
  discount_value numeric not null default 0,
  starts_at timestamp with time zone null,
  ends_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint order_promos_status_check check (status in ('draft','scheduled','active','expired')),
  constraint order_promos_discount_type_check check (discount_type in ('percentage','fixed')),
  constraint order_promos_discount_value_check check (discount_value >= 0)
);

-- Case-insensitive uniqueness for code
create unique index if not exists order_promos_code_lower_uidx on public.order_promos (lower(code));

-- Helpful index for lookup
create index if not exists order_promos_status_idx on public.order_promos (status);

-- Enable RLS
alter table public.order_promos enable row level security;

-- Admins/Super admins can manage promos
create policy "admins_manage_order_promos"
on public.order_promos
for all
using (has_role(auth.uid(), 'admin'::public.app_role) or has_role(auth.uid(), 'super_admin'::public.app_role))
with check (has_role(auth.uid(), 'admin'::public.app_role) or has_role(auth.uid(), 'super_admin'::public.app_role));

-- Public can read only currently-valid promos (for Apply code on /order/payment)
create policy "public_read_valid_order_promos"
on public.order_promos
for select
using (
  (status in ('active','scheduled'))
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

-- Trigger to maintain updated_at
create trigger update_order_promos_updated_at
before update on public.order_promos
for each row
execute function public.update_updated_at_column();
