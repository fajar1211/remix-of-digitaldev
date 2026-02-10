-- Store 3rd-party integration credentials encrypted (ciphertext+iv).
-- Note: edge functions will handle encryption; DB only stores opaque values.

create table if not exists public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  name text not null,
  ciphertext text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_secrets_provider_name_key unique (provider, name)
);

alter table public.integration_secrets enable row level security;

-- Deny direct access from client roles; edge functions (service role) bypass RLS.
create policy "Deny select integration secrets" on public.integration_secrets
for select using (false);

create policy "Deny insert integration secrets" on public.integration_secrets
for insert with check (false);

create policy "Deny update integration secrets" on public.integration_secrets
for update using (false);

create policy "Deny delete integration secrets" on public.integration_secrets
for delete using (false);

-- updated_at trigger
create trigger update_integration_secrets_updated_at
before update on public.integration_secrets
for each row execute function public.update_updated_at_column();

create index if not exists idx_integration_secrets_provider on public.integration_secrets (provider);
create index if not exists idx_integration_secrets_provider_name on public.integration_secrets (provider, name);
