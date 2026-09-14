-- Asymmetric follow relationships between profiles, no approval step.
-- Private to the follower: nobody (including the person followed) can
-- read anyone else's follows rows. A follow is created or deleted,
-- never modified in place, so there is no update policy at all — the
-- same "no write path for a state that never legitimately changes"
-- reasoning already applied to the business-photos bucket. Every
-- policy states its role (`to authenticated`) explicitly, per the
-- convention established after the city-filter feature's RLS
-- near-miss.

create table follows (
  follower_id uuid references profiles(id) on delete cascade,
  followed_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

alter table follows enable row level security;

create policy "Users read own follows" on follows
  for select to authenticated
  using (follower_id = auth.uid());

create policy "Users follow" on follows
  for insert to authenticated
  with check (follower_id = auth.uid());

create policy "Users unfollow" on follows
  for delete to authenticated
  using (follower_id = auth.uid());
