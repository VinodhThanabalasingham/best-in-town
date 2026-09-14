# Following other profiles

## Purpose

The Community directory lists everyone on Best In Town, but there's no
way to narrow it down to the people whose picks you actually trust.
Following lets a user mark specific profiles and filter down to just
theirs on a dedicated page — the "who do I actually care about" layer
on top of "who's on this app at all."

## Follow model

Asymmetric, no approval — same as Twitter/Instagram: clicking Follow
on someone's card immediately creates the relationship, with no
confirmation needed from the person being followed. This matches the
app's existing posture (profiles are already fully public; there's no
privacy boundary a follow request would be protecting).

## Data model

New table `follows`:

- `follower_id uuid references profiles(id) on delete cascade`
- `followed_id uuid references profiles(id) on delete cascade`
- `created_at timestamptz default now()`
- `primary key (follower_id, followed_id)` — a given pair can only
  exist once; following twice is a no-op via `on conflict do nothing`
  at the application layer, not a distinct error case
- `check (follower_id <> followed_id)` — can't follow yourself,
  enforced at the database level rather than only in the UI

**RLS — private to the follower**, per explicit decision: nobody can
read anyone else's follow relationships, including the person being
followed. All three policies below are scoped to `follower_id =
auth.uid()`, `to authenticated` only (no `anon`/`public` access at
all):

```sql
create policy "Users read own follows" on follows
  for select to authenticated
  using (follower_id = auth.uid());

create policy "Users follow" on follows
  for insert to authenticated
  with check (follower_id = auth.uid());

create policy "Users unfollow" on follows
  for delete to authenticated
  using (follower_id = auth.uid());
```

No update policy — a follow relationship is either created or deleted,
never modified in place. This is the same "no write path exists for a
state that never legitimately changes" reasoning already applied to
`business-photos`' bucket policy.

Every policy states its role (`to authenticated`) explicitly, per the
now-established convention on this project (the lesson from the
city-filter feature's RLS near-miss, reinforced by the business-photos
feature's own review).

## UI

**Community page (`/community`):** each profile card gets a Follow /
Following toggle button. The card's existing whole-card `<Link>` (for
navigating to that profile) stays as the primary click target; the
follow button is a separate, explicitly-scoped interactive element
layered on top (not nested inside the anchor, which would be invalid
HTML and ambiguous for click handling) — clicking it must not also
navigate to the profile. The button doesn't render on your own card
(you can't follow yourself, matching the DB constraint).

**New page, `/following`:** auth-required (redirects to `/auth` if not
logged in, same pattern as `/add-pick`/`/edit-profile`). Lists only
the profiles the current user follows, in the same card style as
Community (avatar/initials, name, `@username`, pick count, top-pick
chips), reusing a shared presentational card component extracted from
Community's existing markup rather than duplicating it. Each card also
gets the Follow/Following toggle (so you can unfollow directly from
here). Empty state: "You're not following anyone yet — browse
Community to find people."

**Nav:** gains a "Following" link alongside the existing
Profile/Add a pick/Community/Edit profile links.

## API

Two new routes, both requiring an authenticated session (RLS is the
real enforcement; the routes are thin pass-throughs, same pattern as
every other mutation route in this app):

- `POST /api/follows` — body `{ followedId }`. Inserts
  `{ follower_id: user.id, followed_id: followedId }`. Rejects with
  400 if `followedId` is missing or equals the caller's own id (a
  friendlier error than waiting for the DB's check constraint to fire,
  though that constraint is the actual backstop).
- `DELETE /api/follows/[followedId]` — deletes the row where
  `follower_id = user.id and followed_id = :followedId`.

## Testing

- Type-check / lint / production build clean (existing pattern)
- Manual: follow a profile from Community → button flips to
  "Following" → that profile now appears on `/following`
- Manual: unfollow from `/following` → it disappears from that list,
  and Community's button reverts to "Follow"
- Manual: confirm no Follow button renders on your own card in either
  list
- Manual: confirm an authenticated user cannot read another user's
  `follows` rows directly (RLS is private-to-follower, not just
  hidden in the UI)
