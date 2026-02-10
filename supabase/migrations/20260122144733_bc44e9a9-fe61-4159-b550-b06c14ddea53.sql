-- Create public bucket for template preview images
insert into storage.buckets (id, name, public)
values ('template-previews', 'template-previews', true)
on conflict (id) do update set public = excluded.public;

-- Public can read template preview images
create policy "Public can read template previews"
on storage.objects
for select
to public
using (bucket_id = 'template-previews');

-- Only admins/super_admins can upload template preview images
create policy "Admins can upload template previews"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'template-previews'
  and (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- Only admins/super_admins can update template preview images
create policy "Admins can update template previews"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'template-previews'
  and (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  )
)
with check (
  bucket_id = 'template-previews'
  and (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- Only admins/super_admins can delete template preview images
create policy "Admins can delete template previews"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'template-previews'
  and (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  )
);