-- The Place Details cache upserts into `businesses` (insert-or-update by
-- place_id). schema.sql only ever granted an insert policy, so re-caching
-- an already-known place_id hit RLS's default-deny on UPDATE. Businesses
-- are just cached Google Places metadata, not user-owned data, so any
-- authenticated user may refresh a cached row.

create policy "Authenticated update businesses" on businesses
  for update using (auth.role() = 'authenticated');
