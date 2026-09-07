# City Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a business's major city (from a curated list) be set once when first cached, and let a profile's picks be filtered by city on the public profile page.

**Architecture:** A new `cities` table (curated, public-read-only, same pattern as `topics`) plus a nullable `businesses.city_id` FK. A tightened two-layer RLS (a row policy that only allows setting a *currently-null* city, plus a column-level grant restricted to just `city_id`) lets any authenticated user set a business's city exactly once via a new `PATCH /api/businesses/[id]` route, without being able to touch anything else on that row. The add-pick form shows a required city picker only when the selected business has no city yet. The profile page's existing server-side Topic → Category grouping is unchanged; a new client component receives the already-grouped tree and adds the interactive city-pill filter, computed and filtered entirely in the browser from data already fetched.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Tailwind. No automated test suite — verification is `npx tsc --noEmit`, `npx eslint .`, `npx next build`, plus manual testing via the dev server, per this project's established working style.

**Spec:** `docs/superpowers/specs/2026-09-07-city-filter-design.md`

## Global Constraints

- City belongs to the business, not the pick — set once, shared by everyone who later picks that business. (spec: Data model)
- Cities are curated/developer-managed only — no end-user UI to create or edit a city. (spec: Data model)
- RLS on `businesses.city_id`: a row policy of `using (city_id is null) with check (city_id is not null)` PLUS a column-level `grant update (city_id)` — both layers, not just one. (spec: Data model)
- `pick-card.tsx` needs no changes — editing a pick never changes its business. (spec: Setting a business's city)
- No git worktree — working directly on `main` (established convention from the prior topics plan).
- I (the assistant) hold only Supabase API keys, not a DB connection — any raw SQL must be run by the user in the Supabase SQL editor.
- Migrations 0001–0005 are already applied to the live Supabase project; this plan's migration is `0006`.

---

### Task 1: Migration — `cities` table, seed data, `businesses.city_id`, tightened RLS

**Files:**
- Create: `supabase/migrations/0006_cities.sql`

**Interfaces:**
- Produces: a `cities` table (`id uuid`, `label text`, `normalized_label text unique`, `created_at timestamptz`) with 17 seeded rows; a nullable `businesses.city_id uuid references cities(id)` column; RLS + a column grant restricting who can set it. Task 3 (the PATCH route) relies on this RLS/grant combination being the actual enforcement — the route itself does no extra authorization logic.

- [ ] **Step 1: Write the migration file**

```sql
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
  const { data: cities, error: citiesErr } = await supabase.from('cities').select('id, label').order('label');
  console.log('cities count (expect 17):', cities?.length, citiesErr?.message ?? '');

  const { data: biz, error: bizErr } = await supabase.from('businesses').select('id, city_id').limit(1);
  console.log('businesses select with city_id column (expect no error):', bizErr?.message ?? 'OK', biz);

  if (biz?.[0]) {
    const { data: nameAttempt, error: nameErr } = await supabase
      .from('businesses')
      .update({ name: 'anon-tamper-test' })
      .eq('id', biz[0].id)
      .select();
    console.log('anon attempt to update name column (expect empty array or column-privilege error):', JSON.stringify(nameAttempt), nameErr?.message ?? '');
  }
})();
"
```

Expected: 17 cities printed, `businesses` select succeeds and shows a `city_id` column, and the anon attempt to update `name` returns either an empty array (RLS blocked it — anon isn't even `authenticated`) or a permission error (column grant blocked it). Either outcome confirms the lockdown; do not proceed if the name update actually succeeds with a non-empty returned row.

---

### Task 2: Backfill existing businesses' `city_id`

**Files:** none (data-only, via Supabase SQL editor)

**Interfaces:**
- Consumes: `cities` and `businesses.city_id` from Task 1.
- Produces: every existing `businesses` row has a non-null `city_id`, so the add-pick form's "set a city" flow only triggers going forward for genuinely new businesses.

- [ ] **Step 1: Query for businesses missing a city**

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
supabase.from('businesses').select('id, name, address, city_id').is('city_id', null).then(({ data }) => {
  console.log(data);
});
"
```

- [ ] **Step 2: Ask the user which city each returned business belongs to, then have them run one UPDATE per row in the Supabase SQL editor**

Give the user this template, filled in per row using the `id` values from Step 1 and the city they confirm for each (matching a `label` from the seeded list in Task 1):

```sql
update businesses
set city_id = (select id from cities where label = '<City Label>')
where id = '<business id from Step 1>';
```

Note: this UPDATE is being run directly in the SQL editor as the Postgres owner role, not through the `authenticated` PostgREST role — the column-level grant from Task 1 only restricts the `authenticated`/`anon` roles used by the app, not direct SQL-editor access, so a normal multi-column-capable UPDATE like this works fine here.

- [ ] **Step 3: Verify no businesses remain unassigned**

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
supabase.from('businesses').select('id, name, city_id').is('city_id', null).then(({ data }) => {
  console.log('businesses still missing a city (expect empty array):', data);
});
"
```

Expected: empty array.

---

### Task 3: `PATCH /api/businesses/[id]` — set a business's city

**Files:**
- Create: `app/api/businesses/[id]/route.ts`

**Interfaces:**
- Consumes: `businesses.city_id` RLS/grant from Task 1 as the actual enforcement layer.
- Produces: `PATCH /api/businesses/:id` with JSON body `{ cityId: string }`, authenticated, returns `{ business }` (the full updated row) on success or `{ error }` on failure. Task 4 (the add-pick form) calls this exact route/body/response shape.

- [ ] **Step 1: Write the route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cityId } = await request.json();

  if (typeof cityId !== "string" || !cityId) {
    return NextResponse.json({ error: "cityId is required" }, { status: 400 });
  }

  // RLS ("Authenticated set business city") plus a column-level grant
  // restricted to city_id enforce that this can only ever set a
  // currently-null city_id, never overwrite one, and never touch any
  // other column on the row.
  const { data: business, error } = await supabase
    .from("businesses")
    .update({ city_id: cityId })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to set city" }, { status: 500 });
  }
  if (!business) {
    return NextResponse.json(
      { error: "Business not found, or its city is already set" },
      { status: 404 }
    );
  }

  return NextResponse.json({ business });
}
```

- [ ] **Step 2: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean.

---

### Task 4: Add-pick form — required city picker for a business with no city yet

**Files:**
- Modify: `app/add-pick/add-pick-form.tsx`

**Interfaces:**
- Consumes: `PATCH /api/businesses/[id]` with body `{ cityId }` returning `{ business }` from Task 3. Reads `cities(id, label)` directly via the browser Supabase client (public read, same pattern as the existing `topics` fetch).
- Produces: no exported interface change — this is a leaf page component.

- [ ] **Step 1: Widen the `Business` type and add a `CityOption` type**

Replace the `Business` type (currently):

```typescript
type Business = {
  id: string;
  name: string;
  address: string | null;
};
```

with:

```typescript
type Business = {
  id: string;
  name: string;
  address: string | null;
  city_id: string | null;
};
```

Add near the `TopicOption` type:

```typescript
type CityOption = {
  id: string;
  label: string;
};
```

- [ ] **Step 2: Add city state**

Add alongside the existing `topics`/`topicId` state:

```typescript
  const [cities, setCities] = useState<CityOption[]>([]);
  const [settingCity, setSettingCity] = useState(false);
```

- [ ] **Step 3: Fetch the curated city list once on mount**

Add a new effect alongside the existing topics-fetch effect:

```typescript
  // Curated city list, fetched once — small and static.
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("cities")
      .select("id, label")
      .order("label")
      .then(({ data }) => setCities(data ?? []));
  }, []);
```

- [ ] **Step 4: Add the city-setting handler**

Add a new function alongside `selectPlace`:

```typescript
  async function handleCityChange(cityId: string) {
    if (!business) return;
    setSettingCity(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to set city");
      setBusiness(data.business);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSettingCity(false);
    }
  }
```

- [ ] **Step 5: Require a city before saving**

In `handleSave`, change the guard from:

```typescript
    if (!business || !categoryQuery.trim()) return;
```

to:

```typescript
    if (!business || !categoryQuery.trim() || !business.city_id) return;
```

- [ ] **Step 6: Render the required city picker when the business has no city yet**

Insert right after the business-confirmed box (the block starting `{business && (` that renders `business.name`/`business.address`), before the category-input block:

```tsx
      {business && !business.city_id && (
        <select
          required
          value=""
          onChange={(e) => handleCityChange(e.target.value)}
          disabled={settingCity}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-black"
        >
          <option value="">
            {settingCity ? "Saving city..." : "Which city is this in?"}
          </option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}
```

- [ ] **Step 7: Disable Save until the business has a city**

Change the Save button's `disabled` prop from:

```tsx
          disabled={saving || !categoryQuery.trim() || (isNewCategory && !topicId)}
```

to:

```tsx
          disabled={
            saving ||
            !categoryQuery.trim() ||
            !business.city_id ||
            (isNewCategory && !topicId)
          }
```

- [ ] **Step 8: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean.

---

### Task 5: Profile page — widen the picks query to include city

**Files:**
- Modify: `app/[username]/page.tsx`

**Interfaces:**
- Consumes: `businesses(..., cities(id, label))` nested select from Supabase (via the `businesses.city_id → cities.id` FK from Task 1).
- Produces: `sortedTopicGroups` (the existing grouped structure, unchanged in shape except each pick's `businesses` now also carries `cities`) — Task 6's new client component consumes this exact shape.

- [ ] **Step 1: Widen the `PickRow` type**

Replace the `businesses` field inside `PickRow` (currently):

```typescript
  businesses: {
    id: string;
    name: string;
    address: string | null;
    maps_url: string | null;
    rating: number | null;
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
    cities: { id: string; label: string } | null;
  } | null;
```

- [ ] **Step 2: Widen the picks query's select string**

Replace:

```typescript
    .select(
      "id, note, categories(id, label, topics(id, label)), businesses(id, name, address, maps_url, rating)"
    )
```

with:

```typescript
    .select(
      "id, note, categories(id, label, topics(id, label)), businesses(id, name, address, maps_url, rating, cities(id, label))"
    )
```

- [ ] **Step 3: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit`
Expected: clean (the grouping logic below this query is untouched in this task — Task 6 handles the rendering delegation).

---

### Task 6: City-pill filter — new client component, wired into the profile page

**Files:**
- Create: `app/[username]/city-filter.tsx`
- Modify: `app/[username]/page.tsx`

**Interfaces:**
- Consumes: `sortedTopicGroups` (shape: `{ label: string; categories: { label: string; picks: PickRow[] }[] }[]`, where each `PickRow.businesses.cities` is `{ id, label } | null` per Task 5) and `isOwner: boolean` from `page.tsx`.
- Produces: no further consumers — this is the final rendering layer for the profile page's picks section.

- [ ] **Step 1: Write the new client component**

```tsx
"use client";

import CategoryCard from "@/components/category-card";
import { useMemo, useState } from "react";
import PickCard from "./pick-card";

type CityInfo = { id: string; label: string };

type PickWithCity = {
  id: string;
  note: string | null;
  categories: { id: string; label: string } | null;
  businesses: {
    id: string;
    name: string;
    address: string | null;
    maps_url: string | null;
    rating: number | null;
    cities: CityInfo | null;
  } | null;
};

type CategoryGroup = { label: string; picks: PickWithCity[] };
type TopicGroup = { label: string; categories: CategoryGroup[] };

export default function CityFilterSection({
  topicGroups,
  isOwner,
}: {
  topicGroups: TopicGroup[];
  isOwner: boolean;
}) {
  const cities = useMemo(() => {
    const seen = new Map<string, string>();
    for (const topic of topicGroups) {
      for (const category of topic.categories) {
        for (const pick of category.picks) {
          const city = pick.businesses?.cities;
          if (city) seen.set(city.id, city.label);
        }
      }
    }
    return [...seen.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [topicGroups]);

  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  const filteredTopicGroups = useMemo(() => {
    if (!selectedCityId) return topicGroups;
    return topicGroups
      .map((topic) => ({
        label: topic.label,
        categories: topic.categories
          .map((category) => ({
            label: category.label,
            picks: category.picks.filter(
              (pick) => pick.businesses?.cities?.id === selectedCityId
            ),
          }))
          .filter((category) => category.picks.length > 0),
      }))
      .filter((topic) => topic.categories.length > 0);
  }, [topicGroups, selectedCityId]);

  return (
    <div>
      {cities.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCityId(null)}
            className={`rounded-full border px-3 py-1 text-sm ${
              selectedCityId === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            All cities
          </button>
          {cities.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => setSelectedCityId(city.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                selectedCityId === city.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {city.label}
            </button>
          ))}
        </div>
      )}

      {filteredTopicGroups.length === 0 ? (
        <p className="text-muted-foreground">No picks in this city yet.</p>
      ) : (
        <div className="space-y-14">
          {filteredTopicGroups.map((topic) => (
            <section key={topic.label}>
              <h2 className="mb-6 font-serif text-2xl text-foreground">
                {topic.label}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {topic.categories.map((shelf) => (
                  <CategoryCard key={shelf.label} label={shelf.label}>
                    {shelf.picks.map((pick) => (
                      <PickCard key={pick.id} pick={pick} isOwner={isOwner} />
                    ))}
                  </CategoryCard>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `page.tsx`, replacing the inline rendering**

Add the import near the other imports in `page.tsx`:

```typescript
import CityFilterSection from "./city-filter";
```

Replace the final rendering block (currently):

```tsx
        {sortedTopicGroups.length === 0 ? (
          <p className="mt-10 text-muted-foreground">No picks yet.</p>
        ) : (
          <div className="mt-10 space-y-14">
            {sortedTopicGroups.map((topic) => (
              <section key={topic.label}>
                <h2 className="mb-6 font-serif text-2xl text-foreground">
                  {topic.label}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {topic.categories.map((shelf) => (
                    <CategoryCard key={shelf.label} label={shelf.label}>
                      {shelf.picks.map((pick) => (
                        <PickCard key={pick.id} pick={pick} isOwner={isOwner} />
                      ))}
                    </CategoryCard>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
```

with:

```tsx
        {sortedTopicGroups.length === 0 ? (
          <p className="mt-10 text-muted-foreground">No picks yet.</p>
        ) : (
          <div className="mt-10">
            <CityFilterSection topicGroups={sortedTopicGroups} isOwner={isOwner} />
          </div>
        )}
```

Since `CategoryCard` and `PickCard` are no longer used directly in `page.tsx`, also remove their now-unused imports there (`import CategoryCard from "@/components/category-card";` and `import PickCard from "./pick-card";`).

- [ ] **Step 3: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean — in particular, no "unused import" lint errors in `page.tsx`, and no type mismatch passing `sortedTopicGroups` (built from the widened `PickRow` in Task 5) into `CityFilterSection`'s `TopicGroup[]` prop.

---

### Task 7: Full build + manual end-to-end verification

**Files:** none (verification only)

**Interfaces:** none — this task exercises the whole feature through the running app.

- [ ] **Step 1: Production build**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx next build`
Expected: succeeds. Route list gains `/api/businesses/[id]`; no other routes change.

- [ ] **Step 2: Start the dev server**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npm run dev` — first check `ps aux | grep next` and kill any stray instance (an established habit in this project — prior sessions repeatedly left background dev servers running).

- [ ] **Step 3: Hand off to the user for the interactive parts**

Ask the user to, while logged in:
1. Go to `/add-pick`, search and select a **brand-new** business (one never picked before) — confirm the "Which city is this in?" dropdown appears and Save stays disabled until a city is chosen and successfully saved.
2. Search and select an **already-cached** business (e.g. one from an earlier pick) — confirm no city picker appears and Save works immediately once category/topic requirements are met.
3. Visit their own profile page — confirm city pills appear above the topic list, "All cities" is selected by default, and clicking a specific city filters down to only that city's topics/categories/picks (with topics/categories that have zero matching picks disappearing entirely for that selection).

Only report this task complete once the user confirms all three checks passed.
