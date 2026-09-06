-- Best In Town — initial schema
-- Run this in the Supabase SQL editor for a new project.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized_label text unique not null, -- lowercase, trimmed, for matching
  created_at timestamptz default now()
);

create table businesses (
  id uuid primary key default gen_random_uuid(),
  place_id text unique not null,       -- Google Places place_id
  name text not null,
  address text,
  rating numeric,
  photo_url text,
  maps_url text,
  cached_at timestamptz default now()
);

create table picks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  note text,
  created_at timestamptz default now()
);

-- Row level security
alter table profiles enable row level security;
alter table categories enable row level security;
alter table businesses enable row level security;
alter table picks enable row level security;

-- Public read on everything (profiles are public by design)
create policy "Public read profiles" on profiles for select using (true);
create policy "Public read categories" on categories for select using (true);
create policy "Public read businesses" on businesses for select using (true);
create policy "Public read picks" on picks for select using (true);

-- Users can only write their own data
create policy "Users insert own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "Users update own profile" on profiles
  for update using (auth.uid() = id);

create policy "Users insert own picks" on picks
  for insert with check (auth.uid() = profile_id);
create policy "Users update own picks" on picks
  for update using (auth.uid() = profile_id);
create policy "Users delete own picks" on picks
  for delete using (auth.uid() = profile_id);

-- Anyone signed in can add a category or cache a business (shared resources)
create policy "Authenticated insert categories" on categories
  for insert with check (auth.role() = 'authenticated');
create policy "Authenticated insert businesses" on businesses
  for insert with check (auth.role() = 'authenticated');
