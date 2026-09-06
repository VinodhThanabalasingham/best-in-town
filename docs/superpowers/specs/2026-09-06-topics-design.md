# Topics: grouping categories into a curated taxonomy

## Purpose

Categories (e.g. "Best coffee", "Best plumber") currently form a flat,
user-created list. Two problems emerge as the number of categories
grows:

1. **Profile scanability** — a profile with 15+ categories is hard to
   scan as a flat list of shelves.
2. **Cross-profile discovery** (future) — a "browse all Food & Drink
   picks" view needs categories to map into a small, consistent set,
   not whatever ad hoc strings users typed.

Both goals need the same thing: a curated, fixed set of **topics**
that every category belongs to.

## Data model

New table `topics`:

- `id uuid primary key default gen_random_uuid()`
- `label text not null`
- `normalized_label text unique not null`
- `created_at timestamptz default now()`

Curated, developer-managed only — no UI for end users to create or
edit topics. RLS: public `select`, no `insert`/`update`/`delete`
policies (only reachable via the Supabase SQL editor / service role).

Seed list (12 topics):

- Breakfast Options
- Cafes & Coffee
- Bars
- Pubs
- Restaurants
- Takeaway
- Desserts & Bakeries
- Services
- Health & Beauty
- Shopping & Retail
- Leisure & Entertainment
- Other

`categories` gets a new column: `topic_id uuid references topics(id)`.
Nullable initially (the 2 existing categories need manual backfill via
one-off SQL), intended to become `not null` once backfilled — enforced
at the application layer (new categories always get a topic at
creation time), not as a DB constraint in this pass, to avoid a
migration ordering headache.

**Alternative considered:** a many-to-many join table
(`category_topics`), allowing a category like "Best brunch" to live
under both Breakfast Options and Restaurants. Rejected for v1 — real
complexity (topic dropdown becomes multi-select, profile-page grouping
needs de-duplication across topics) for a case that may not come up in
practice. Revisit if it turns out to matter.

## Category creation flow

`lib/categories.ts`'s `resolveCategoryId` gains a required `topicId`
parameter:

- **Match branch** (existing `normalized_label` found): `topicId` is
  ignored — the existing category's topic is authoritative.
- **Insert branch** (no match): `topicId` must be present; the new
  category row is inserted with it. Missing `topicId` on this branch
  is a validation error.

Both `POST /api/picks` and `PATCH /api/picks/[id]` pass `topicId`
through from the request body.

## UI changes

**Add-pick form** (`app/add-pick/add-pick-form.tsx`) and **pick-card
edit mode** (`app/[username]/pick-card.tsx`): when the typed category
text doesn't match any live suggestion (i.e. submitting would create a
new category), a `<select>` of the 12 curated topics appears and is
required before Save/submit is enabled. Selecting an existing
suggestion hides the topic picker — nothing to choose.

Topic options are fetched via a direct public read against the
`topics` table (same pattern as the existing category-suggestion
query), not a dedicated API route.

## Profile page

`app/[username]/page.tsx`'s grouping gains one level: **Topic** →
**Category** → shelf of pick cards, same visual "shelf" pattern as
today (topic as a larger heading, category as the existing
sub-heading). The picks query's nested select grows one level:
`categories(id, label, topics(id, label))`.

Topics are ordered alphabetically for now (same as categories today);
no manual ordering/curation of topic display order in this pass.

## Error handling

- Creating a new category without a `topicId` → 400 from the API
  routes, surfaced as a form error (same pattern as existing
  `categoryLabel is required` checks).
- A category whose `topic_id` is null (only possible for the 2
  legacy rows before backfill) renders under a synthetic "Uncategorized"
  bucket on the profile page rather than crashing, purely as a
  transitional safety net.

## Testing

- Type-check / lint / production build clean (existing pattern for
  every change in this project)
- Manual: create a pick with a brand-new category → topic dropdown
  required → profile page shows it nested under the right topic
  - Reuse the migration verification pattern used for prior schema
  changes: I run raw SQL checks via the anon client where possible;
  the user runs the actual migration in the Supabase SQL editor since
  I only hold API keys, not a DB connection
- Manual: pick an existing category from suggestions → no topic
  dropdown appears, pick still saves correctly
- Manual: edit an existing pick's category to a new one → same topic
  requirement applies in the inline edit card
