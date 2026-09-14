-- Storage bucket for business photos, fetched once from Google Places
-- when a business is first cached (never per-pick, never per-view).
-- Public read (photos show on public profile pages); insert only by
-- authenticated users (the server-side caching request is always
-- authenticated as the user adding the pick). No update/delete policy
-- at all — a photo is set exactly once and never changed afterward,
-- so there is no legitimate write path to guard against widening.
-- Every policy below states its role explicitly (`to public` /
-- `to authenticated`) rather than leaving it implicit — this is the
-- direct lesson from the city-filter feature's RLS near-miss, where
-- an omitted role clause let a policy apply to the anon role too.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-photos',
  'business-photos',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Public read business photos"
  on storage.objects for select
  to public
  using (bucket_id = 'business-photos');

create policy "Authenticated upload business photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'business-photos');
