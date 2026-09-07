-- Migration 0006 created the businesses UPDATE policy without a `to
-- authenticated` clause, so it applied to PUBLIC (including the
-- unauthenticated anon role) — and only revoked/re-granted UPDATE
-- privileges for the authenticated role, never touching anon's
-- original broad UPDATE grant. Net effect: an anonymous caller could
-- rewrite any column on a null-city business row, as long as the same
-- statement also set city_id to a non-null value. This migration
-- closes both gaps.

drop policy "Authenticated set business city" on businesses;

create policy "Authenticated set business city" on businesses
  for update
  to authenticated
  using (city_id is null)
  with check (city_id is not null);

revoke update on businesses from anon;
