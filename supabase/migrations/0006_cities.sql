-- Curated major cities that businesses belong to. Developer-managed
-- only — no end-user UI to create or edit a city.

create table cities (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized_label text unique not null,
  created_at timestamptz default now()
);

alter table cities enable row level security;

create policy "Public read cities" on cities for select using (true);

insert into cities (label, normalized_label) values
  ('Sydney', 'sydney'),
  ('Melbourne', 'melbourne'),
  ('Brisbane', 'brisbane'),
  ('Perth', 'perth'),
  ('Adelaide', 'adelaide'),
  ('Canberra', 'canberra'),
  ('Hobart', 'hobart'),
  ('Darwin', 'darwin'),
  ('Gold Coast', 'gold coast'),
  ('New York', 'new york'),
  ('London', 'london'),
  ('Paris', 'paris'),
  ('Amsterdam', 'amsterdam'),
  ('Rome', 'rome'),
  ('Milan', 'milan'),
  ('Barcelona', 'barcelona'),
  ('Other', 'other');

alter table businesses add column city_id uuid references cities(id);

-- A business's city may be set exactly once: this row policy only
-- allows an UPDATE when the existing row has no city yet, and only
-- if the new row has one (never un-set, never overwritten).
create policy "Authenticated set business city" on businesses
  for update
  using (city_id is null)
  with check (city_id is not null);

-- Column-level enforcement, independent of RLS: even within a row
-- the policy above allows, Postgres refuses any UPDATE statement
-- that names a column outside this grant. This is what actually
-- prevents the policy from ever being widened by accident into
-- "any authenticated user can rewrite any business field."
revoke update on businesses from authenticated;
grant update (city_id) on businesses to authenticated;
