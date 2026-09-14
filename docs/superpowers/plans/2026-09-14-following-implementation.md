# Following Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user follow other profiles from Community, and view just the profiles they follow on a new `/following` page.

**Architecture:** A new `follows` table (asymmetric, no approval, private to the follower) backs two thin API routes for following/unfollowing. A `ProfileCard` presentational component is extracted from Community's existing card markup so both Community and the new Following page render identical cards, each with a `FollowButton` overlay that toggles via the two new routes. The card's existing whole-card navigation `<Link>` becomes an absolutely-positioned full-card element so the Follow button can sit on top of it as a separate, explicitly higher-stacked interactive element — never nested inside the anchor.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Tailwind, lucide-react icons. No automated test suite — verification is `npx tsc --noEmit`, `npx eslint .`, `npx next build`, plus manual testing via the dev server.

**Spec:** `docs/superpowers/specs/2026-09-14-following-design.md`

## Global Constraints

- Asymmetric follow, no approval step — clicking Follow creates the relationship immediately. (spec: Follow model)
- `follows` RLS is private to the follower — all three policies (select/insert/delete) scoped to `follower_id = auth.uid()`, every one `to authenticated`, none `to public`/`anon`. (spec: Data model)
- No update policy on `follows` at all — a follow is created or deleted, never modified in place. (spec: Data model)
- A profile's own card never shows a Follow button (can't follow yourself — also enforced at the DB level via a check constraint). (spec: UI)
- The Follow button must not be nested inside the card's navigation `<Link>` (invalid HTML, ambiguous click handling) — it must be a separate element that visually overlays the link via explicit stacking, not a DOM descendant of it. (spec: UI)
- No git worktree — working directly on `main` (established convention from prior plans).
- I (the assistant) hold only Supabase API keys, not a DB connection — any raw SQL must be run by the user in the Supabase SQL editor.
- Migrations 0001–0008 are already applied to the live Supabase project; this plan's migration is `0009`.

---

### Task 1: Migration — `follows` table with private-to-follower RLS

**Files:**
- Create: `supabase/migrations/0009_follows.sql`

**Interfaces:**
- Produces: a `follows` table (`follower_id uuid`, `followed_id uuid`, `created_at timestamptz`, composite primary key on `(follower_id, followed_id)`, `check (follower_id <> followed_id)`) with three RLS policies, all `to authenticated`, all scoped to `follower_id = auth.uid()`. Task 3's routes rely on this as the sole enforcement layer.

- [ ] **Step 1: Write the migration file**

```sql
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
  const { data, error } = await supabase.from('follows').select('*').limit(1);
  console.log('anon select on follows (expect empty array, RLS blocks unauthenticated read):', JSON.stringify(data), error?.message ?? '');

  const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
  const someId = profiles?.[0]?.id;
  if (someId) {
    const { error: insertError } = await supabase.from('follows').insert({ follower_id: someId, followed_id: someId });
    console.log('anon insert attempt (expect DENIED):', insertError ? 'DENIED: ' + insertError.message : 'UNEXPECTEDLY SUCCEEDED');
  }
})();
"
```

Expected: the select returns an empty array (anon has no session, so `auth.uid()` is null and matches no rows — this is RLS working, not a bug), and the insert attempt is denied (anon is not `authenticated`).

---

### Task 2: `FollowButton` client component

**Files:**
- Create: `components/follow-button.tsx`

**Interfaces:**
- Consumes: `POST /api/follows` and `DELETE /api/follows/[followedId]` (from Task 3 — this task can be implemented and reviewed independently since the exact request/response shape is specified here and doesn't require Task 3 to exist yet, but the routes must exist before this component works end-to-end).
- Produces: `<FollowButton followedId={string} initiallyFollowing={boolean} />`. Task 4's `ProfileCard` renders this component directly with these exact two props.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";

export default function FollowButton({
  followedId,
  initiallyFollowing,
}: {
  followedId: string;
  initiallyFollowing: boolean;
}) {
  const [isFollowing, setIsFollowing] = useState(initiallyFollowing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const res = isFollowing
        ? await fetch(`/api/follows/${followedId}`, { method: "DELETE" })
        : await fetch("/api/follows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ followedId }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setIsFollowing(!isFollowing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
          isFollowing
            ? "border-border text-muted-foreground hover:border-destructive hover:text-destructive"
            : "border-primary bg-primary/10 text-primary hover:bg-primary/20"
        }`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean.

---

### Task 3: `POST /api/follows` and `DELETE /api/follows/[followedId]`

**Files:**
- Create: `app/api/follows/route.ts`
- Create: `app/api/follows/[followedId]/route.ts`

**Interfaces:**
- Consumes: the `follows` table and its RLS from Task 1 as the sole enforcement layer — these routes do minimal validation of their own (missing/self-follow checks for a friendlier error) but rely on RLS for the actual authorization.
- Produces: `POST /api/follows` with JSON body `{ followedId: string }` → `{ ok: true }` or `{ error }`. `DELETE /api/follows/:followedId` → `{ ok: true }` or `{ error }`. Task 2's `FollowButton` calls both exactly as specified here.

- [ ] **Step 1: Write `app/api/follows/route.ts`**

```typescript
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

  const { followedId } = await request.json();

  if (typeof followedId !== "string" || !followedId) {
    return NextResponse.json({ error: "followedId is required" }, { status: 400 });
  }
  if (followedId === user.id) {
    return NextResponse.json({ error: "You can't follow yourself" }, { status: 400 });
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, followed_id: followedId });

  if (error) {
    if (error.code === "23505") {
      // Already following — idempotent success.
      return NextResponse.json({ ok: true });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write `app/api/follows/[followedId]/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ followedId: string }> }
) {
  const { followedId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followed_id", followedId);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean.

---

### Task 4: `ProfileCard` component + rewire Community to use it

**Files:**
- Create: `components/profile-card.tsx`
- Modify: `app/community/page.tsx`

**Interfaces:**
- Consumes: `FollowButton` from Task 2 (exact props `{ followedId, initiallyFollowing }`).
- Produces: `<ProfileCard profile={{id, username, display_name, avatar_url}} pickCount={number} topPicks={string[]} accent={"primary" | "accent"} isOwnProfile={boolean} isFollowing={boolean} />`. Task 5's Following page renders this exact component with these exact props.

- [ ] **Step 1: Write `components/profile-card.tsx`**

Read `app/community/page.tsx` in full first to see the card markup this extracts (the plan below already reflects it).

```tsx
import FollowButton from "@/components/follow-button";
import { ArrowUpRight, MapPin } from "lucide-react";
import Link from "next/link";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function ProfileCard({
  profile,
  pickCount,
  topPicks,
  accent,
  isOwnProfile,
  isFollowing,
}: {
  profile: Profile;
  pickCount: number;
  topPicks: string[];
  accent: "primary" | "accent";
  isOwnProfile: boolean;
  isFollowing: boolean;
}) {
  const displayName = profile.display_name || profile.username;

  return (
    <div className="elevate elevate-hover group relative flex flex-col gap-5 rounded-3xl border border-border/70 bg-card p-6">
      <Link
        href={`/${profile.username}`}
        className="absolute inset-0 rounded-3xl"
        aria-label={displayName}
      />

      <div className="pointer-events-none flex items-start justify-between">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className={
                accent === "primary"
                  ? "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-serif text-lg text-primary"
                  : "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-serif text-lg text-accent"
              }
            >
              {initials(displayName)}
            </span>
          )}
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {displayName}
            </h2>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          </div>
        </div>
        <ArrowUpRight
          className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground"
          aria-hidden="true"
        />
      </div>

      <div className="pointer-events-none mt-auto flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <MapPin aria-hidden="true" className="h-3 w-3" />
          {pickCount} {pickCount === 1 ? "pick" : "picks"}
        </span>
        {topPicks.map((name) => (
          <span
            key={name}
            className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-foreground/80"
          >
            {name}
          </span>
        ))}
      </div>

      {!isOwnProfile && (
        <div className="relative z-10 self-start">
          <FollowButton followedId={profile.id} initiallyFollowing={isFollowing} />
        </div>
      )}
    </div>
  );
}
```

Note on the stacking approach: the card's outer `<div>` is `relative` (establishes a stacking context); the navigation `<Link>` is `absolute inset-0` with no explicit `z-index` (defaults to auto/0); the Follow button's wrapper is `relative z-10`, which places it above the Link in stacking order, so clicks on the button go to the button, not the underlying full-card link. The decorative content in between (avatar, name, pick-count badge) is wrapped in `pointer-events-none` divs so clicks pass through to the Link beneath them — only the Follow button itself is a real click target besides the Link.

- [ ] **Step 2: Rewire `app/community/page.tsx` to use `ProfileCard`**

Read the current file in full first. Replace its entire contents with:

```tsx
import ProfileCard from "@/components/profile-card";
import { createClient } from "@/lib/supabase/server";

type PickRow = {
  profile_id: string;
  businesses: { name: string } | null;
};

export default async function CommunityPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .order("username");

  const { data: picks } = await supabase
    .from("picks")
    .select("profile_id, businesses(name)")
    .returns<PickRow[]>();

  const pickCounts = new Map<string, number>();
  const topPickNames = new Map<string, string[]>();
  for (const pick of picks ?? []) {
    pickCounts.set(pick.profile_id, (pickCounts.get(pick.profile_id) ?? 0) + 1);
    if (pick.businesses?.name) {
      const names = topPickNames.get(pick.profile_id) ?? [];
      if (names.length < 3) names.push(pick.businesses.name);
      topPickNames.set(pick.profile_id, names);
    }
  }

  let followingIds = new Set<string>();
  if (user) {
    const { data: follows } = await supabase
      .from("follows")
      .select("followed_id")
      .eq("follower_id", user.id);
    followingIds = new Set((follows ?? []).map((f) => f.followed_id));
  }

  return (
    <div className="min-h-screen">
      <main className="above-grain mx-auto max-w-4xl px-6 pb-24 pt-10 md:px-10 md:pt-14">
        <section className="max-w-xl">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Community
          </p>
          <h1 className="mt-3 text-balance font-serif text-4xl leading-tight tracking-tight text-foreground md:text-5xl">
            Who to trust in town
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Browse other people&apos;s shelves and steal their best picks.
            Tap anyone to see everything they swear by.
          </p>
        </section>

        {!profiles || profiles.length === 0 ? (
          <p className="mt-10 text-muted-foreground">No profiles yet.</p>
        ) : (
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {profiles.map((profile, index) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                pickCount={pickCounts.get(profile.id) ?? 0}
                topPicks={topPickNames.get(profile.id) ?? []}
                accent={index % 2 === 0 ? "primary" : "accent"}
                isOwnProfile={user?.id === profile.id}
                isFollowing={followingIds.has(profile.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean.

---

### Task 5: `/following` page + nav link

**Files:**
- Create: `app/following/page.tsx`
- Modify: `components/nav.tsx`

**Interfaces:**
- Consumes: `ProfileCard` from Task 4 (exact props as defined there).
- Produces: no further consumers — this is a leaf page.

- [ ] **Step 1: Write `app/following/page.tsx`**

```tsx
import ProfileCard from "@/components/profile-card";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type PickRow = {
  profile_id: string;
  businesses: { name: string } | null;
};

export default async function FollowingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: followRows } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", user.id);

  const followedIds = (followRows ?? []).map((f) => f.followed_id);

  const { data: followedProfiles } =
    followedIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", followedIds)
          .order("username")
      : { data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null }[] };

  const { data: picks } =
    followedIds.length > 0
      ? await supabase
          .from("picks")
          .select("profile_id, businesses(name)")
          .in("profile_id", followedIds)
          .returns<PickRow[]>()
      : { data: [] as PickRow[] };

  const pickCounts = new Map<string, number>();
  const topPickNames = new Map<string, string[]>();
  for (const pick of picks ?? []) {
    pickCounts.set(pick.profile_id, (pickCounts.get(pick.profile_id) ?? 0) + 1);
    if (pick.businesses?.name) {
      const names = topPickNames.get(pick.profile_id) ?? [];
      if (names.length < 3) names.push(pick.businesses.name);
      topPickNames.set(pick.profile_id, names);
    }
  }

  return (
    <div className="min-h-screen">
      <main className="above-grain mx-auto max-w-4xl px-6 pb-24 pt-10 md:px-10 md:pt-14">
        <section className="max-w-xl">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Following
          </p>
          <h1 className="mt-3 text-balance font-serif text-4xl leading-tight tracking-tight text-foreground md:text-5xl">
            Your people
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            The shelves you actually check.
          </p>
        </section>

        {!followedProfiles || followedProfiles.length === 0 ? (
          <p className="mt-10 text-muted-foreground">
            You&apos;re not following anyone yet — browse{" "}
            <Link href="/community" className="underline">
              Community
            </Link>{" "}
            to find people.
          </p>
        ) : (
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {followedProfiles.map((profile, index) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                pickCount={pickCounts.get(profile.id) ?? 0}
                topPicks={topPickNames.get(profile.id) ?? []}
                accent={index % 2 === 0 ? "primary" : "accent"}
                isOwnProfile={user.id === profile.id}
                isFollowing={true}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add the nav link**

Read `components/nav.tsx` in full first. Add a new `<Link>` for Following, placed after the existing Community link:

```tsx
          <Link
            href="/community"
            className="hidden text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:inline"
          >
            Community
          </Link>
          <Link
            href="/following"
            className="hidden text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:inline"
          >
            Following
          </Link>
```

(Insert the new `Following` `<Link>` block immediately after the existing `Community` `<Link>` block — the `Community` block itself is unchanged, shown above only for placement context.)

- [ ] **Step 3: Verify**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx tsc --noEmit && npx eslint .`
Expected: both clean.

---

### Task 6: Full build + manual end-to-end verification

**Files:** none (verification only)

**Interfaces:** none — this task exercises the whole feature through the running app.

- [ ] **Step 1: Production build**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npx next build`
Expected: succeeds. Route list gains `/following`, `/api/follows`, `/api/follows/[followedId]`.

- [ ] **Step 2: Start the dev server**

Run: `cd "/Users/vinodhthanabalasingham/Desktop/best-in-town" && npm run dev` — first check `ps aux | grep next` and kill any stray instance (an established habit in this project).

- [ ] **Step 3: Hand off to the user for the interactive parts**

Ask the user to, while logged in:
1. On `/community`, click "Follow" on another profile's card — confirm the button flips to "Following" and clicking the card itself (not the button) still navigates to that profile.
2. Visit `/following` — confirm the profile just followed appears there.
3. Click "Following" on that same card (either on `/community` or `/following`) to unfollow — confirm it flips back to "Follow" and disappears from `/following`.
4. Confirm no Follow button appears on their own card in either `/community` or `/following`.

Only report this task complete once the user confirms all four checks passed.
