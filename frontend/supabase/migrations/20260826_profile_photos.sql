-- Fotos de perfil privadas, com um diretório exclusivo por usuário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'endoacolhe-profile-photos',
  'endoacolhe-profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Usuários enviam somente a própria foto de perfil" on storage.objects;
create policy "Usuários enviam somente a própria foto de perfil"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'endoacolhe-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Usuários leem somente a própria foto de perfil" on storage.objects;
create policy "Usuários leem somente a própria foto de perfil"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'endoacolhe-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Usuários substituem somente a própria foto de perfil" on storage.objects;
create policy "Usuários substituem somente a própria foto de perfil"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'endoacolhe-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'endoacolhe-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Usuários removem somente a própria foto de perfil" on storage.objects;
create policy "Usuários removem somente a própria foto de perfil"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'endoacolhe-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
