-- Website settings table (for editable public-site configuration)
create table if not exists public.website_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.website_settings enable row level security;

-- Public read (Contact page is public)
create policy "Website settings are publicly readable"
on public.website_settings
for select
using (true);

-- Admin/Super Admin write
create policy "Admins can insert website settings"
on public.website_settings
for insert
with check (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

create policy "Admins can update website settings"
on public.website_settings
for update
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

create policy "Admins can delete website settings"
on public.website_settings
for delete
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Keep updated_at current
drop trigger if exists update_website_settings_updated_at on public.website_settings;
create trigger update_website_settings_updated_at
before update on public.website_settings
for each row
execute function public.update_updated_at_column();
