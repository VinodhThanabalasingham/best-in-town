-- Curated topics that categories belong to. Developer-managed only —
-- no end-user UI to create or edit a topic.

create table topics (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized_label text unique not null,
  created_at timestamptz default now()
);

alter table topics enable row level security;

create policy "Public read topics" on topics for select using (true);

insert into topics (label, normalized_label) values
  ('Breakfast Options', 'breakfast options'),
  ('Cafes & Coffee', 'cafes & coffee'),
  ('Bars', 'bars'),
  ('Pubs', 'pubs'),
  ('Restaurants', 'restaurants'),
  ('Takeaway', 'takeaway'),
  ('Desserts & Bakeries', 'desserts & bakeries'),
  ('Services', 'services'),
  ('Health & Beauty', 'health & beauty'),
  ('Shopping & Retail', 'shopping & retail'),
  ('Leisure & Entertainment', 'leisure & entertainment'),
  ('Other', 'other');

alter table categories add column topic_id uuid references topics(id);
