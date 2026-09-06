-- Storage bucket for profile avatars. Public read (avatars show on
-- public profile pages); writes restricted to a user's own folder
-- (path convention: {user_id}/avatar, no extension, so re-uploading
-- always overwrites rather than leaving orphaned files).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
