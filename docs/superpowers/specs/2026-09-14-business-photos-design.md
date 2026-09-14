# Business photos on pick tiles

## Purpose

Pick tiles currently show a styled initial-letter placeholder instead
of the business. Pulling in real photos from Google Places makes tiles
recognizable at a glance, closing out the last item from the original
four-item follow-up request (home/community, city filter, swipeable
tiles, photos).

## Cost context

Google's Places Photo (New) API is billed per request (roughly
$7/1,000 as of writing — verify against Google's current pricing page
before relying on this number long-term). This is only a real cost
concern if it were called per pick or per profile view. It isn't: the
design below calls it **once per new business, ever**, exactly
mirroring how Place Details is already cached once and never
re-fetched live. At the project's actual scale (~9 businesses cached
total so far), this is a negligible cost.

## Data flow

`businesses.photo_url` already exists in `schema.sql` (added at
initial setup, never populated). No schema migration needed for the
column itself — this feature just starts writing to it.

`app/api/places/details/route.ts` already checks the `businesses`
cache by `place_id` before ever calling Google (added when Place
Details itself was made cache-first). Photo fetching plugs into the
exact same cache-miss branch: only when caching a business for the
first time.

Flow, extending the existing cache-miss branch:

1. `getPlaceDetails` requests `photos.name` in its field mask
   alongside the existing fields, and returns the first photo's
   reference name (or `null` if the business has no photos).
2. If a photo reference exists, a new `getPlacePhoto(photoName)`
   helper calls the Places Photo (New) media endpoint
   (`GET /v1/{photoName}/media?maxWidthPx=800`) with the same API key
   header used elsewhere. Google's media endpoint responds with an
   HTTP redirect to the actual image; `fetch`'s default redirect
   behavior follows it transparently, so the helper ends up with the
   raw image bytes and a content-type header — no manual redirect
   handling needed.
3. The route uploads those bytes to a new Supabase Storage bucket
   (`business-photos`) at a path keyed by `place_id` (stable, already
   known before the business row is inserted — unlike `businesses.id`,
   which is only generated at insert time).
4. The resulting public Storage URL is written to `photo_url` on the
   same insert that already writes `name`/`address`/`rating`/`maps_url`.

**Failure handling:** if the photo fetch or upload fails for any
reason (no photos on the place, a transient Google error, a storage
error), the failure is logged and swallowed — `photo_url` stays null
and the business/pick save proceeds normally. Photos are an
enhancement to an already-working flow, not a new dependency it can
fail on.

## Storage bucket and RLS

New bucket `business-photos`: public read, 5MB file size limit,
`image/jpeg`/`image/png`/`image/webp` only (same shape as the existing
`avatars` bucket).

**RLS, applying the lesson from the city-filter feature's near-miss:**
every policy gets an explicit role clause — no policy is ever written
without stating `to public` or `to authenticated` outright, rather
than leaving the role implicit and hoping the predicate alone scopes
it correctly.

- `to public` — anyone may `select` (read) objects in this bucket;
  photos are shown on public profile pages.
- `to authenticated` — a logged-in user may `insert` an object into
  this bucket (needed since the upload happens from the same
  server-side request that's already authenticated as the user adding
  the pick).
- **No update or delete policy at all.** A business's photo is set
  exactly once, at the same moment its row is first cached, and never
  changed afterward — there is no legitimate reason for any policy
  permitting a write to an existing object in this bucket, at any
  scope. This sidesteps the entire class of bug the city feature hit
  (an update policy that was scoped more broadly than intended) by not
  having an update policy in the first place.

## UI

`PickCard`'s tile (the aspect-[5/4] image slot) renders the real photo
when `pick.businesses.photo_url` is set, falling back to today's
gradient + initial-letter placeholder when it's null. Type widening
(`photo_url: string | null` on the `businesses` shape) flows through
`app/[username]/page.tsx`'s query and `PickRow` type → its
`city-filter.tsx` props → `pick-card.tsx`'s own `Pick` type — the same
propagation path already used for `cities` in the city-filter feature.

No changes to `add-pick-form.tsx` or any pick-editing flow — this is
purely something that happens automatically when a business is cached,
with no user-facing control over it.

## Testing

- Type-check / lint / production build clean (existing pattern)
- Manual: add a pick for a brand-new business that has Google photos →
  confirm a real photo appears on its tile after saving, and that the
  business row in Supabase has a non-null `photo_url` pointing at the
  new Storage bucket
- Manual: add a pick for a business with no Google photos (or force a
  photo-fetch failure) → confirm the pick still saves successfully and
  the tile falls back to the initial-letter placeholder
- Manual: confirm an anonymous (unauthenticated) request cannot insert
  into the `business-photos` bucket, and that a public (unauthenticated)
  read of an existing object succeeds
