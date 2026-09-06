# Topics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group categories under a curated set of 12 topics, surfaced as a required topic picker when creating a brand-new category, and as one more nesting level (Topic → Category → picks) on the public profile page.

**Architecture:** One new `topics` table (developer-curated, public-read-only) plus a nullable `topic_id` FK on `categories`. `lib/categories.ts`'s `resolveCategoryId` takes an optional `topicId`, required only when actually inserting a new category — an existing category match ignores it. Both picks API routes and both category-editing UIs (add-pick form, profile page's inline pick-card editor) pass it through. The profile page's grouping logic gains one outer level.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Tailwind. No automated test suite exists in this project — verification is `npx tsc --noEmit`, `npx eslint .`, `npx next build`, plus manual smoke testing via the dev server, per the project's established working style.

**Spec:** `docs/superpowers/specs/2026-09-06-topics-design.md`

## Global Constraints

- Topics are curated/developer-managed only — no end-user UI to create or edit a topic. (spec: Data model)
- `topic_id` is required when inserting a brand-new category, ignored when matching an existing one. (spec: Category creation flow)
- RLS on `topics`: public `select`, no `insert`/`update`/`delete` policies. (spec: Data model)
- No git repository exists in this project — skip commit steps; each task's own verification (type-check/lint/build/manual check) is the completion signal.
- I (the assistant) hold only Supabase API keys, not a DB connection — any raw SQL must be run by the user in the Supabase SQL editor. (established earlier in this project)
- A category with a null `topic_id` (only possible for the 2 pre-existing legacy rows before backfill) renders under a synthetic "Uncategorized" bucket rather than crashing. (spec: Error handling)

---

### Task 1: Migration — `topics` table, seed data, `categories.topic_id`

**Files:**
- Create: `supabase/migrations/0003_topics.sql`

**Interfaces:**
- Produces: a `topics` table (`id uuid`, `label text`, `normalized_label text unique`, `created_at timestamptz`) with 12 seeded rows; a nullable `categories.topic_id uuid references topics(id)` column. Later tasks query `topics(id, label)` and write `categories.topic_id`.

- [ ] **Step 1: Write the migration file**

```sql
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
  const { data, error } = await supabase.from('topics').select('id, label').order('label');
  console.log('topics count (expect 12):', data?.length, error?.message ?? '');
  const { data: cats, error: catErr } = await supabase.from('categories').select('id, label, topic_id');
  console.log('categories with topic_id column (expect no error):', catErr?.message ?? 'OK', cats);
})();
"
```

Expected: 12 topics printed, and the `categories` select succeeds and shows a `topic_id` column (null for existing rows).

---

### Task 2: Backfill the 2 legacy categories' `topic_id`

**Files:** none (data-only, via Supabase SQL editor)

**Interfaces:**
- Consumes: `topics` and `categories` from Task 1.
- Produces: both existing category rows have a non-null `topic_id`, so Task 7's "Uncategorized" fallback has nothing to actually catch in this project's current data (it remains as a safety net for any future gap).

- [ ] **Step 1: Ask the user to run this SELECT in the Supabase SQL editor and share the output**

```sql
select id, label, normalized_label from categories where topic_id is null;
```

- [ ] **Step 2: For each row returned, have the user run a targeted UPDATE**

Give the user this template, filled in per row using the `id` values from Step 1 and picking the appropriate topic from the seeded list (e.g. a coffee-related category → `Cafes & Coffee`, a breakfast-related one → `Breakfast Options`):

```sql
update categories
set topic_id = (select id from topics where label = '<Topic Label>')
where id = '<category id from Step 1>';
```

- [ ] **Step 3: Verify no categories remain unassigned**

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
supabase.from('categories').select('id, label, topic_id').is('topic_id', null).then(({ data }) => {
  console.log('categories still missing a topic (expect empty array):', data);
});
"
```

Expected: empty array.

---

### Task 3: `lib/categories.ts` — `resolveCategoryId` takes `topicId`

**Files:**
- Modify: `lib/categories.ts` (full replacement)

**Interfaces:**
- Consumes: nothing new.
- Produces: `resolveCategoryId(supabase: SupabaseClient, categoryLabel: string, topicId?: string): Promise<{ categoryId: string } | { error: string; status: number }>`. The `error` shape now carries an HTTP `status` (400 for "topicId is required for a new category", 500 for actual DB failures) so callers don't have to guess which status to return. Tasks 4 and 5 consume this exact signature.

- [ ] **Step 1: Replace the file contents**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

// Resolves a category by normalized_label, inserting it if it doesn't
// exist yet. Race-safe: if two requests insert the same normalized
// label concurrently, the loser re-reads the winner's row instead of
// erroring. topicId is only required when actually inserting a new
// category — an existing match's topic is authoritative and topicId
// is ignored in that branch.
export async function resolveCategoryId(
  supabase: SupabaseClient,
  categoryLabel: string,
  topicId?: string
): Promise<{ categoryId: string } | { error: string; status: number }> {
  const normalizedLabel = normalizeLabel(categoryLabel);

  const { data: existing, error: lookupError } = await supabase
    .from("categories")
    .select("id")
    .eq("normalized_label", normalizedLabel)
    .maybeSingle();

  if (lookupError) {
    console.error(lookupError);
    return { error: "Failed to look up category", status: 500 };
  }

  if (existing) {
    return { categoryId: existing.id };
  }

  if (!topicId) {
    return { error: "topicId is required for a new category", status: 400 };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("categories")
    .insert({
      label: categoryLabel.trim(),
      normalized_label: normalizedLabel,
      topic_id: topicId,
    })
    .select("id")
    .single();

  if (!insertError) {
    return { categoryId: inserted.id };
  }

  if (insertError.code === "23505") {
    // Lost a race with another insert of the same normalized label.
    const { data: retry, error: retryError } = await supabase
      .from("categories")
      .select("id")
      .eq("normalized_label", normalizedLabel)
      .single();
    if (retryError) {
      console.error(retryError);
      return { error: "Failed to create category", status: 500 };
    }
    return { categoryId: retry.id };
  }

  console.error(insertError);
  return { error: "Failed to create category", status: 500 };
}
```

- [ ] **Step 2: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit`
Expected: errors in `app/api/picks/route.ts` and `app/api/picks/[id]/route.ts` (they still call `resolveCategoryId` with 2 args and read `resolved.error` without `status` — both keys still type-check fine on read, but the `status: 500` hardcoded in those routes is now redundant, not broken). This is expected and resolved by Tasks 4–5; do not fix those files in this task.

---

### Task 4: `POST /api/picks` — pass `topicId` through

**Files:**
- Modify: `app/api/picks/route.ts`

**Interfaces:**
- Consumes: `resolveCategoryId(supabase, categoryLabel, topicId)` from Task 3.
- Produces: no change to this route's own exported shape; still `POST` returning `{ pick }` or `{ error }`.

- [ ] **Step 1: Replace the file contents**

```typescript
import { resolveCategoryId } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId, categoryLabel, note, topicId } = await request.json();

  if (typeof businessId !== "string" || !businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }
  if (typeof categoryLabel !== "string" || !categoryLabel.trim()) {
    return NextResponse.json({ error: "categoryLabel is required" }, { status: 400 });
  }

  const resolved = await resolveCategoryId(
    supabase,
    categoryLabel,
    typeof topicId === "string" ? topicId : undefined
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { data: pick, error: pickError } = await supabase
    .from("picks")
    .insert({
      profile_id: user.id,
      business_id: businessId,
      category_id: resolved.categoryId,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .select()
    .single();

  if (pickError) {
    console.error(pickError);
    return NextResponse.json({ error: "Failed to save pick" }, { status: 500 });
  }

  return NextResponse.json({ pick });
}
```

- [ ] **Step 2: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit`
Expected: no errors referencing `app/api/picks/route.ts`.

---

### Task 5: `PATCH /api/picks/[id]` — pass `topicId` through

**Files:**
- Modify: `app/api/picks/[id]/route.ts`

**Interfaces:**
- Consumes: `resolveCategoryId(supabase, categoryLabel, topicId)` from Task 3.
- Produces: no change to this route's own exported shape.

- [ ] **Step 1: Replace the `PATCH` function (leave `DELETE` untouched)**

```typescript
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

  const { categoryLabel, note, topicId } = await request.json();

  if (typeof categoryLabel !== "string" || !categoryLabel.trim()) {
    return NextResponse.json({ error: "categoryLabel is required" }, { status: 400 });
  }

  const resolved = await resolveCategoryId(
    supabase,
    categoryLabel,
    typeof topicId === "string" ? topicId : undefined
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  // RLS ("Users update own picks") enforces that this only affects a
  // row the caller owns; a non-owner's request simply matches zero rows.
  const { data: pick, error } = await supabase
    .from("picks")
    .update({
      category_id: resolved.categoryId,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update pick" }, { status: 500 });
  }
  if (!pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  return NextResponse.json({ pick });
}
```

- [ ] **Step 2: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean, no errors anywhere in the project (this closes out the type error expected after Task 3).

---

### Task 6: Add-pick form — topic picker for new categories

**Files:**
- Modify: `app/add-pick/add-pick-form.tsx`

**Interfaces:**
- Consumes: `POST /api/picks` now optionally accepts `topicId` in its JSON body (Task 4). Reads `topics(id, label)` directly via the browser Supabase client (public read, same pattern as the existing `categories` suggestion query at lines 81–86).
- Produces: no exported interface change — this is a leaf page component.

- [ ] **Step 1: Add the `TopicOption` type and topic state**

Add near the top, alongside the existing `CategorySuggestion` type (after line 21):

```typescript
type TopicOption = {
  id: string;
  label: string;
};
```

Add state, alongside the other category-related state (after the `categorySuggestions` state, around line 39):

```typescript
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicId, setTopicId] = useState("");
```

- [ ] **Step 2: Fetch the curated topic list once on mount**

Add a new effect after the existing category-suggestions effect (after the effect ending at line 89):

```typescript
  // Curated topic list, fetched once — small and static.
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("topics")
      .select("id, label")
      .order("label")
      .then(({ data }) => setTopics(data ?? []));
  }, []);
```

- [ ] **Step 3: Compute whether the typed category is new**

Add just before the `if (saved)` early return (before line 150):

```typescript
  const matchedCategory = categorySuggestions.find(
    (c) => c.label.toLowerCase() === categoryQuery.trim().toLowerCase()
  );
  const isNewCategory = categoryQuery.trim().length > 0 && !matchedCategory;
```

- [ ] **Step 4: Require and send `topicId` only when creating a new category**

In `handleSave` (starting at line 124), change the guard and the fetch body:

```typescript
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !categoryQuery.trim()) return;
    if (isNewCategory && !topicId) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          categoryLabel: categoryQuery.trim(),
          note,
          ...(isNewCategory ? { topicId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save pick");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }
```

- [ ] **Step 5: Reset `topicId` in the "add another pick" reset**

In `reset()` (starting at line 112), add `setTopicId("");` alongside the other resets.

- [ ] **Step 6: Render the topic `<select>` when creating a new category**

Insert right after the category input's closing `</div>` (after line 249, before the `<textarea placeholder="Note (optional)"`):

```tsx
          {isNewCategory && (
            <select
              required
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-black"
            >
              <option value="">Choose a topic for this new category&hellip;</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
```

- [ ] **Step 7: Disable Save until a new category also has a topic**

Change the Save button's `disabled` prop (around line 266):

```tsx
          disabled={saving || !categoryQuery.trim() || (isNewCategory && !topicId)}
```

- [ ] **Step 8: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean.

---

### Task 7: Pick-card inline edit — topic picker for new categories

**Files:**
- Modify: `app/[username]/pick-card.tsx`

**Interfaces:**
- Consumes: `PATCH /api/picks/[id]` now optionally accepts `topicId` in its JSON body (Task 5).
- Produces: no exported interface change.

- [ ] **Step 1: Add the `TopicOption` type and topic state**

Add near the top, alongside `CategorySuggestion` (after line 21):

```typescript
type TopicOption = {
  id: string;
  label: string;
};
```

Add state, alongside `categorySuggestions` (after line 35):

```typescript
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicId, setTopicId] = useState("");
```

- [ ] **Step 2: Fetch topics lazily when edit mode opens**

Add a new effect after the existing category-suggestions effect (after line 52):

```typescript
  // Curated topic list, fetched lazily the first time edit mode opens.
  useEffect(() => {
    if (mode !== "edit" || topics.length > 0) return;
    const supabase = createClient();
    supabase
      .from("topics")
      .select("id, label")
      .order("label")
      .then(({ data }) => setTopics(data ?? []));
  }, [mode, topics.length]);
```

- [ ] **Step 3: Compute whether the typed category is new**

Add just before `handleSave` (before line 54):

```typescript
  const matchedCategory = categorySuggestions.find(
    (c) => c.label.toLowerCase() === categoryQuery.trim().toLowerCase()
  );
  const isNewCategory = categoryQuery.trim().length > 0 && !matchedCategory;
```

- [ ] **Step 4: Require and send `topicId` only when creating a new category**

Update `handleSave` (starting at line 54):

```typescript
  async function handleSave() {
    if (!categoryQuery.trim()) return;
    if (isNewCategory && !topicId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/picks/${pick.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryLabel: categoryQuery.trim(),
          note,
          ...(isNewCategory ? { topicId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setMode("view");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }
```

- [ ] **Step 5: Reset `topicId` on Cancel**

In the Cancel button's `onClick` (around line 143), add `setTopicId("");` alongside the other resets.

- [ ] **Step 6: Render the topic `<select>` when creating a new category**

Insert right after the category input's closing `</div>` (after line 124, before the `<textarea`):

```tsx
          {isNewCategory && (
            <select
              required
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
            >
              <option value="">Choose a topic&hellip;</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
```

- [ ] **Step 7: Disable Save until a new category also has a topic**

Change the Save button's `disabled` prop (around line 136):

```tsx
              disabled={saving || (isNewCategory && !topicId)}
```

- [ ] **Step 8: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean.

---

### Task 8: Profile page — nest Topic → Category → picks

**Files:**
- Modify: `app/[username]/page.tsx`

**Interfaces:**
- Consumes: `categories(id, label, topics(id, label))` nested select from Supabase (topics from Task 1; the FK `categories.topic_id → topics.id` makes this nested select work automatically via PostgREST).
- Produces: no exported interface change — this is the route's page component.

- [ ] **Step 1: Widen the `PickRow` type**

Replace (lines 5–16):

```typescript
type PickRow = {
  id: string;
  note: string | null;
  categories:
    | {
        id: string;
        label: string;
        topics: { id: string; label: string } | null;
      }
    | null;
  businesses: {
    id: string;
    name: string;
    address: string | null;
    maps_url: string | null;
    rating: number | null;
  } | null;
};
```

- [ ] **Step 2: Widen the picks query's select string**

Replace (lines 41–48):

```typescript
  const { data: picks } = await supabase
    .from("picks")
    .select(
      "id, note, categories(id, label, topics(id, label)), businesses(id, name, address, maps_url, rating)"
    )
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<PickRow[]>();
```

- [ ] **Step 3: Replace the flat grouping with Topic → Category nesting**

Replace the grouping block (lines 50–61):

```typescript
  const UNCATEGORIZED_LABEL = "Uncategorized";

  const topicGroups = new Map<
    string,
    {
      label: string;
      categories: Map<string, { label: string; picks: PickRow[] }>;
    }
  >();

  for (const pick of picks ?? []) {
    if (!pick.categories) continue;

    const topicKey = pick.categories.topics?.id ?? "uncategorized";
    const topicLabel = pick.categories.topics?.label ?? UNCATEGORIZED_LABEL;
    if (!topicGroups.has(topicKey)) {
      topicGroups.set(topicKey, { label: topicLabel, categories: new Map() });
    }
    const topicGroup = topicGroups.get(topicKey)!;

    const categoryKey = pick.categories.id;
    if (!topicGroup.categories.has(categoryKey)) {
      topicGroup.categories.set(categoryKey, {
        label: pick.categories.label,
        picks: [],
      });
    }
    topicGroup.categories.get(categoryKey)!.picks.push(pick);
  }

  const sortedTopicGroups = [...topicGroups.values()]
    .map((topic) => ({
      label: topic.label,
      categories: [...topic.categories.values()].sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
```

- [ ] **Step 4: Replace the rendering to nest one more level**

Replace the shelves rendering block (lines 84–99, the `{sortedShelves.length === 0 ? ... : ...}` block — note the length check now uses `sortedTopicGroups`):

```tsx
      {sortedTopicGroups.length === 0 ? (
        <p className="text-zinc-500">No picks yet.</p>
      ) : (
        <div className="space-y-14">
          {sortedTopicGroups.map((topic) => (
            <div key={topic.label}>
              <h2 className="mb-6 text-xl font-semibold">{topic.label}</h2>
              <div className="space-y-10">
                {topic.categories.map((shelf) => (
                  <section key={shelf.label}>
                    <h3 className="mb-3 text-lg font-medium">{shelf.label}</h3>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {shelf.picks.map((pick) => (
                        <PickCard key={pick.id} pick={pick} isOwner={isOwner} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 5: Verify types and lint**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean. Note `PickCard`'s own `pick` prop type (in `pick-card.tsx`) only destructures `categories: { id, label }`, which is structurally compatible with the wider `PickRow.categories` type here (extra `topics` field is simply unused by `PickCard`) — no change needed there.

---

### Task 9: Full build + manual end-to-end verification

**Files:** none (verification only)

**Interfaces:** none — this task exercises the whole feature through the running app.

- [ ] **Step 1: Production build**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx next build`
Expected: succeeds, same route list as before (this feature adds no new routes).

- [ ] **Step 2: Start the dev server**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npm run dev` (check `ps aux | grep next` first and kill any stray instance before starting, per this project's established habit of leaked background dev servers)

- [ ] **Step 3: Verify the topics list is publicly readable and still exactly 12**

```bash
node -e "
const fs = require('fs');
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]; })
);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.from('topics').select('label').order('label').then(({ data }) => console.log(data));
"
```

- [ ] **Step 4: Hand off to the user for the interactive parts**

Ask the user to, while logged in:
1. Go to `/add-pick`, search and select a business, then type a brand-new category (one that doesn't match any suggestion) — confirm the topic `<select>` appears and Save stays disabled until a topic is chosen.
2. Type an existing category (exact match to a suggestion) — confirm the topic picker does NOT appear and Save works without one.
3. Visit their own profile page — confirm picks now nest under a topic heading above the existing category heading.
4. Edit an existing pick's category to a brand-new one via the pick-card inline editor — confirm the same topic-picker requirement applies there too.

Only report this task complete once the user confirms all four checks passed.
