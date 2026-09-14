# Business Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull a real photo from Google Places into `businesses.photo_url` the first time a business is ever cached, and show it on pick tiles, falling back to the existing initial-letter placeholder when there isn't one.

**Architecture:** Extend the existing cache-miss branch in `app/api/places/details/route.ts` (already the one place a new business gets cached) to also fetch one photo from Google's Places Photo (New) media endpoint and upload it to a new, narrowly-scoped Supabase Storage bucket. A photo failure never blocks saving the business or the pick — it's swallowed and logged. Type widening (`photo_url`) flows through the same propagation path already used for `cities`: `page.tsx` → `city-filter.tsx` → `pick-card.tsx`.

**Tech Stack:** Next.js App Router, Supabase (Postgres + Storage + RLS), TypeScript, Tailwind, Google Places API (New). No automated test suite — verification is `npx tsc --noEmit`, `npx eslint .`, `npx next build`, plus manual testing via the dev server.

**Spec:** `docs/superpowers/specs/2026-09-14-business-photos-design.md`

## Global Constraints

- `businesses.photo_url` already exists in `schema.sql` — no column migration needed, only a Storage bucket + RLS migration.
- Photo fetch/upload happens **only** on the cache-miss branch (a brand-new business) — never for an already-cached business, never per pick, never per profile view. (spec: Data flow)
- A photo failure (no photos on the place, Google error, storage error) is logged and swallowed — `photo_url` stays null, the business/pick save proceeds normally. (spec: Data flow, "Failure handling")
- Every Storage RLS policy gets an explicit role clause (`to public` or `to authenticated`) — never an implicit/unscoped policy. (spec: Storage bucket and RLS — this is the direct lesson from the city-filter feature's near-miss)
- No update or delete policy on the `business-photos` bucket at all — a photo is set once, never changed. (spec: Storage bucket and RLS)
- No git worktree — working directly on `main` (established convention from prior plans).
- I (the assistant) hold only Supabase API keys, not a DB connection — any raw SQL/Storage bucket creation must be run by the user in the Supabase SQL editor.
- Migrations 0001–0007 are already applied to the live Supabase project; this plan's migration is `0008`.

---

### Task 1: Migration — `business-photos` Storage bucket + RLS

**Files:**
- Create: `supabase/migrations/0008_business_photos.sql`

**Interfaces:**
- Produces: a public-read Storage bucket named `business-photos` (5MB limit, image/jpeg|png|webp only) with exactly two policies (`select` `to public`, `insert` `to authenticated`) and no others. Task 2's route relies on this bucket existing with these exact permissions — it does no additional authorization itself.

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Hand the SQL to the user to run**

Tell the user to paste this file's contents into the Supabase SQL editor (New query → paste → Run), same as every prior migration in this project. Wait for their confirmation before continuing.

- [ ] **Step 3: Verify from the assistant side with the anon key**

```bash
cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && node -e "
const fs = require('fs');
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]; })
);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data: listData, error: listError } = await supabase.storage.from('business-photos').list();
  console.log('anon list bucket (expect ok, empty array):', listError ? 'ERROR: ' + listError.message : 'OK', listData);

  const fakeFile = new Blob(['test'], { type: 'image/jpeg' });
  const { error: uploadError } = await supabase.storage.from('business-photos').upload('anon-test-upload', fakeFile, { contentType: 'image/jpeg' });
  console.log('anon upload attempt (expect DENIED):', uploadError ? 'DENIED: ' + uploadError.message : 'UNEXPECTEDLY SUCCEEDED');
})();
"
```

Expected: the list call succeeds (public read confirmed), and the anon upload attempt is denied (confirms `to authenticated` actually excludes the anon role — this is exactly the check the prior feature's own verification probe failed to include).

---

### Task 2: Fetch and cache a business's photo on first cache

**Files:**
- Modify: `lib/places.ts`
- Modify: `app/api/places/details/route.ts`

**Interfaces:**
- Consumes: the `business-photos` bucket and its RLS from Task 1.
- Produces: `getPlaceDetails` now also returns `photoName: string | null`. A new `getPlacePhoto(photoName: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null>` is exported from `lib/places.ts` — returns `null` on any non-OK response rather than throwing, so callers can treat "no photo" and "photo fetch failed" the same way (skip silently). Task 3 does not depend on either of these directly (it only touches `photo_url` as plain data), but future maintainers reading this route need the exact shape.

- [ ] **Step 1: Widen `PlaceDetails` and the field mask in `lib/places.ts`**

Replace the `PlaceDetails` type (currently):

```typescript
export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  mapsUrl: string | null;
};
```

with:

```typescript
export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  mapsUrl: string | null;
  photoName: string | null;
};
```

In `getPlaceDetails`, replace the field mask header value (currently):

```typescript
        "X-Goog-FieldMask": "id,displayName,formattedAddress,rating,googleMapsUri",
```

with:

```typescript
        "X-Goog-FieldMask": "id,displayName,formattedAddress,rating,googleMapsUri,photos.name",
```

And replace the function's return statement (currently):

```typescript
  return {
    placeId: data.id,
    name: data.displayName?.text ?? "",
    address: data.formattedAddress ?? null,
    rating: data.rating ?? null,
    mapsUrl: data.googleMapsUri ?? null,
  };
```

with:

```typescript
  return {
    placeId: data.id,
    name: data.displayName?.text ?? "",
    address: data.formattedAddress ?? null,
    rating: data.rating ?? null,
    mapsUrl: data.googleMapsUri ?? null,
    photoName: data.photos?.[0]?.name ?? null,
  };
```

- [ ] **Step 2: Add `getPlacePhoto` to `lib/places.ts`**

Add this new exported function at the end of the file:

```typescript
export async function getPlacePhoto(
  photoName: string
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const res = await fetch(`${PLACES_BASE}/${photoName}/media?maxWidthPx=800`, {
    headers: { "X-Goog-Api-Key": apiKey() },
  });

  if (!res.ok) return null;

  const bytes = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { bytes, contentType };
}
```

Note: Google's Photo (New) media endpoint responds with an HTTP redirect to the actual image by default; `fetch`'s default redirect behavior (`follow`) resolves it transparently, so `res` here is already the final image response — no manual redirect handling needed.

- [ ] **Step 3: Wire photo fetch + upload into the cache-miss branch of the route**

Read `app/api/places/details/route.ts` in full first. Update the import line (currently):

```typescript
import { getPlaceDetails } from "@/lib/places";
```

to:

```typescript
import { getPlaceDetails, getPlacePhoto } from "@/lib/places";
```

Between the `const details = await getPlaceDetails(placeId, sessionToken);` line and the `const { data: business, error } = await supabase.from("businesses").insert({...})` call, insert:

```typescript
    let photoUrl: string | null = null;
    if (details.photoName) {
      try {
        const photo = await getPlacePhoto(details.photoName);
        if (photo) {
          const { error: uploadError } = await supabase.storage
            .from("business-photos")
            .upload(placeId, photo.bytes, { contentType: photo.contentType });
          if (uploadError) {
            console.error("Failed to upload business photo", uploadError);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from("business-photos")
              .getPublicUrl(placeId);
            photoUrl = publicUrlData.publicUrl;
          }
        }
      } catch (photoErr) {
        console.error("Failed to fetch business photo", photoErr);
      }
    }
```

Then add `photo_url: photoUrl,` as a new field in the `.insert({...})` call's object (alongside the existing `place_id`/`name`/`address`/`rating`/`maps_url` fields).

The whole block above must NOT be wrapped in a way that lets a thrown error inside it escape to the route's outer `catch` — it already has its own try/catch, so a photo failure can never turn into the route's generic 502 "Failed to fetch place details" response. Do not change the route's existing outer try/catch or its error response.

- [ ] **Step 4: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean.

---

### Task 3: Widen `photo_url` through the display path and render it

**Files:**
- Modify: `app/[username]/page.tsx`
- Modify: `app/[username]/city-filter.tsx`
- Modify: `app/[username]/pick-card.tsx`

**Interfaces:**
- Consumes: `businesses.photo_url` (already written by Task 2; already nullable/existing in the DB regardless of this plan).
- Produces: no further consumers — this is the final rendering layer.

- [ ] **Step 1: Widen `page.tsx`'s `PickRow` type and query**

In the `PickRow` type's `businesses` field, replace:

```typescript
  businesses: {
    id: string;
    name: string;
    address: string | null;
    maps_url: string | null;
    rating: number | null;
    cities: { id: string; label: string } | null;
  } | null;
```

with:

```typescript
  businesses: {
    id: string;
    name: string;
    address: string | null;
    maps_url: string | null;
    rating: number | null;
    photo_url: string | null;
    cities: { id: string; label: string } | null;
  } | null;
```

Replace the picks query's select string (currently):

```typescript
      "id, note, categories(id, label, topics(id, label)), businesses(id, name, address, maps_url, rating, cities(id, label))"
```

with:

```typescript
      "id, note, categories(id, label, topics(id, label)), businesses(id, name, address, maps_url, rating, photo_url, cities(id, label))"
```

- [ ] **Step 2: Widen `city-filter.tsx`'s `PickWithCity` type**

Replace the `businesses` field inside `PickWithCity` (currently):

```typescript
  businesses: {
    id: string;
    name: string;
    address: string | null;
    maps_url: string | null;
    rating: number | null;
    cities: CityInfo | null;
  } | null;
```

with:

```typescript
  businesses: {
    id: string;
    name: string;
    address: string | null;
    maps_url: string | null;
    rating: number | null;
    photo_url: string | null;
    cities: CityInfo | null;
  } | null;
```

- [ ] **Step 3: Widen `pick-card.tsx`'s `Pick` type**

Replace the `businesses` field inside `Pick` (currently):

```typescript
  businesses: {
    name: string;
    address: string | null;
    maps_url: string | null;
  } | null;
```

with:

```typescript
  businesses: {
    name: string;
    address: string | null;
    maps_url: string | null;
    photo_url: string | null;
  } | null;
```

- [ ] **Step 4: Render the real photo when present, falling back to the placeholder**

In `pick-card.tsx`, replace the view-mode tile block (currently):

```tsx
      {mode === "view" && (
        <div
          className="flex aspect-[5/4] w-full items-center justify-center overflow-hidden rounded-lg border border-border/70"
          style={{
            background:
              "linear-gradient(150deg, color-mix(in srgb, var(--tile-accent, var(--primary)) 24%, var(--card)) 0%, var(--card) 78%)",
          }}
        >
          <span
            aria-hidden="true"
            className="font-serif text-6xl leading-none"
            style={{ color: "var(--tile-accent, var(--primary))" }}
          >
            {pick.businesses?.name?.charAt(0)}
          </span>
        </div>
      )}
```

with:

```tsx
      {mode === "view" && (
        <div className="aspect-[5/4] w-full overflow-hidden rounded-lg border border-border/70">
          {pick.businesses?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pick.businesses.photo_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background:
                  "linear-gradient(150deg, color-mix(in srgb, var(--tile-accent, var(--primary)) 24%, var(--card)) 0%, var(--card) 78%)",
              }}
            >
              <span
                aria-hidden="true"
                className="font-serif text-6xl leading-none"
                style={{ color: "var(--tile-accent, var(--primary))" }}
              >
                {pick.businesses?.name?.charAt(0)}
              </span>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 5: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean — in particular, no type error passing the widened `PickRow`-derived data into `CityFilterSection`'s `TopicGroup` prop (the extra `photo_url` field flows through structurally, same as `cities` did in the prior plan).

---

### Task 4: Full build + manual end-to-end verification

**Files:** none (verification only)

**Interfaces:** none — this task exercises the whole feature through the running app.

- [ ] **Step 1: Production build**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx next build`
Expected: succeeds. No route list changes (this feature adds no new API routes).

- [ ] **Step 2: Start the dev server**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npm run dev` — first check `ps aux | grep next` and kill any stray instance (an established habit in this project — prior sessions repeatedly left background dev servers running).

- [ ] **Step 3: Hand off to the user for the interactive parts**

Ask the user to, while logged in:
1. Go to `/add-pick`, search and select a **brand-new** business (one never picked before, ideally one you know has photos on Google Maps) — after saving, visit the profile page and confirm the tile shows a real photo instead of the initial-letter placeholder.
2. Check the `businesses` table in Supabase for that row — confirm `photo_url` is a non-null URL pointing at the new `business-photos` bucket.
3. Add a pick for an already-cached business (one picked before this feature shipped, or a second pick on the same brand-new business from step 1) — confirm nothing breaks and no duplicate photo-fetch happens (the cache-hit branch returns immediately, unchanged).

Only report this task complete once the user confirms all three checks passed.
