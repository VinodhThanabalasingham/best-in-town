# City filter: grouping picks by major city

## Purpose

"Best speakeasy bar" should be answerable separately per city — Sydney's
answer and Melbourne's answer are different questions, not one flat
list. Users need to filter their profile by a major city so the same
category can hold picks from multiple cities without them blurring
together.

## Data model

City is a property of the **business**, not the pick: a business's
physical location doesn't change no matter who picks it or what
category they file it under. Setting it once, on the business, means
everyone who later picks that same cached business inherits the
correct city automatically, with no repeated data entry and no risk
of the same business disagreeing with itself across different picks.

Google's address data for Australian businesses gives suburb-level
detail (e.g. "Newtown", "Marrickville"), not a reliable "major city"
field — auto-deriving Sydney vs. Melbourne from it isn't feasible.
So, same pattern as `topics`: a small curated list, chosen manually.

New table `cities`:

- `id uuid primary key default gen_random_uuid()`
- `label text not null`
- `normalized_label text unique not null`
- `created_at timestamptz default now()`

Curated, developer-managed only — no end-user UI to create or edit a
city. RLS: public `select`, no `insert`/`update`/`delete` policies.

Seed list (17 cities):

Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra, Hobart,
Darwin, Gold Coast, New York, London, Paris, Amsterdam, Rome, Milan,
Barcelona, Other.

`businesses` gets a new column: `city_id uuid references cities(id)`.
Nullable (existing cached businesses need manual backfill via one-off
SQL, same as the topics backfill).

**RLS, tightened deliberately given the earlier lesson from the topics
feature** (a too-broad `businesses` UPDATE policy had to be revoked
once discovered in review): the goal is "any authenticated user may
set a business's city exactly once, and touch nothing else on that
row, ever." Two layers:

1. A policy allowing `UPDATE` only where the *existing* row has
   `city_id is null`, and only if the *new* row has `city_id is not
   null` — `using (city_id is null) with check (city_id is not
   null)`. This makes the policy itself refuse to ever overwrite an
   already-set city or leave one newly null.
2. A column-level `grant update (city_id) on businesses to
   authenticated` (and nothing broader) — even within a row the
   policy allows, Postgres refuses any UPDATE statement that touches
   a column outside this grant. This is enforced independently of
   RLS, so it holds even if a future policy is accidentally widened.

## Setting a business's city

`selectPlace` in the add-pick form is unchanged: one Places-details
call, cache-check-first (as already implemented), same response
shape. If the returned business has `city_id: null` — a brand-new
business, or an old business cached before this feature existed — the
form shows a required city `<select>` (options fetched once from the
public `cities` table, same pattern as the topics picker).

Choosing a city calls a new endpoint, `PATCH /api/businesses/[id]`,
body `{ cityId }`. This route is a thin, authenticated pass-through —
the actual enforcement is the RLS + column grant above, not
application logic. On success it returns the updated business row;
the form merges `city_id` into its local `business` state.

Save stays disabled until the business has a city — either it already
did (existing cached business, most common case going forward), or
this flow just set it.

`app/[username]/pick-card.tsx` needs **no changes**. Editing a pick
only ever changes its category/note; the business — and therefore its
city — stays fixed, exactly as today.

## Profile page filter

The picks query gains one more nested level:
`businesses(..., cities(id, label))`. The existing server-side Topic →
Category grouping logic is unchanged — city is carried on each pick's
`businesses.cities` field alongside everything already there.

The already-grouped tree is handed to a new client component
(`app/[username]/city-filter.tsx` or similar) that:

- Computes the distinct set of cities actually present across this
  profile's picks (not the full curated list — a profile with only
  Sydney picks shows only a "Sydney" pill, not all 17)
- Renders "All cities" (default, selected on load) plus one pill per
  distinct city
- Filters the already-fetched Topic → Category → picks tree in the
  browser on click — no extra network request, no URL query params.
  A topic/category with zero remaining picks after filtering is
  hidden entirely for that selection.

## Error handling

- `PATCH /api/businesses/[id]` with a missing/invalid `cityId` → 400,
  surfaced as a form error (same pattern as existing validation
  checks elsewhere in this app)
- A business whose city was never backfilled (only possible for
  pre-existing cached rows before this feature's SQL backfill runs)
  shows the required city picker in the add-pick form the next time
  anyone selects it — this is the intended recovery path, not a
  special case to handle separately
- Picks whose business has no city (transitional state, same
  scenario as above) are simply omitted from every city pill's count
  until backfilled, and only visible under "All cities"

## Testing

- Type-check / lint / production build clean (existing pattern)
- Manual: cache a brand-new business → city picker required → Save
  disabled until chosen → picking a city persists it
- Manual: pick an already-cached (already-citied) business → no city
  picker appears, Save works immediately
- Manual: attempt to change an existing business's city via a raw
  PATCH request as a different authenticated user → confirm RLS
  denies it (`city_id is null` no longer true for that row)
- Manual: profile page shows only the city pills relevant to that
  profile's actual picks, and filtering hides/shows the right
  topics/categories/picks
