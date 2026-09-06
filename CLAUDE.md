# Best In Town

An app where users build a profile showcasing the best local business in
each category, in their own words — e.g. "Single O — best coffee in Sydney."

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase: Postgres + Auth + Storage
- Google Places API (New): Autocomplete + Place Details
- Deploy target: Vercel, Hobby plan (free, non-commercial — do not add
  paid add-ons or assume Pro-tier limits)

## Core loop

1. User searches a business (Google Places Autocomplete, debounced ~300ms)
2. User selects a result → app calls Place Details once, caches the result
   in `businesses` (never re-call Places live to render a profile)
3. User picks an existing category or creates a new one — always try to
   match against existing categories first (case-insensitive, trimmed)
   before creating a new row, so "Best coffee" and "best Coffee" resolve
   to the same category
4. Save a row in `picks` linking profile + business + category (+ optional note)
5. Public profile page renders picks from the database only — no live
   Places calls on view

## Data model

See `schema.sql`. Four tables: `profiles`, `categories`, `businesses`, `picks`.

## Screens (build in this order)

1. Auth (sign up / log in) — Supabase Auth, email or magic link
2. Add-a-pick flow — search → select business → pick/create category → save
3. Public profile page (`/[username]`) — grid of picks, each linking out
   to the cached Google Maps URL
4. Edit/delete a pick

## Constraints to respect

- Secrets only in `.env.local` (see `.env.example`), never hardcoded,
  `.env.local` must be in `.gitignore` before first commit
- Debounce all Places API calls — don't fire on every keystroke
- Category matching happens server-side against `normalized_label`,
  not client-side string comparison
- Keep this a web app — no React Native/Expo yet

## Working style

- Build one screen/feature at a time. After each one: run the dev server,
  check the console for errors yourself, fix what you find, then hand
  back for review before moving to the next item.
- Don't restructure earlier work without flagging why.
