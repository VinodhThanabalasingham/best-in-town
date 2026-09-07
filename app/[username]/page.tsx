import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CityFilterSection from "./city-filter";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

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
    cities: { id: string; label: string } | null;
  } | null;
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  const { data: picks } = await supabase
    .from("picks")
    .select(
      "id, note, categories(id, label, topics(id, label)), businesses(id, name, address, maps_url, rating, cities(id, label))"
    )
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<PickRow[]>();

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

  const totalCategories = sortedTopicGroups.reduce(
    (sum, topic) => sum + topic.categories.length,
    0
  );
  const totalPicks = sortedTopicGroups.reduce(
    (sum, topic) =>
      sum + topic.categories.reduce((s, c) => s + c.picks.length, 0),
    0
  );

  const displayName = profile.display_name || profile.username;

  return (
    <div className="min-h-screen">
      <main className="above-grain mx-auto max-w-4xl px-6 pb-24 pt-10 md:px-10 md:pt-14">
        <section className="flex items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="elevate flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-serif text-xl text-primary"
            >
              {initials(displayName)}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-semibold leading-none tracking-tight text-foreground md:text-4xl">
              {displayName}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              @{profile.username} &middot; {totalCategories} shelves &middot;{" "}
              {totalPicks} picks
            </p>
          </div>
        </section>

        {sortedTopicGroups.length === 0 ? (
          <p className="mt-10 text-muted-foreground">No picks yet.</p>
        ) : (
          <div className="mt-12">
            <CityFilterSection topicGroups={sortedTopicGroups} isOwner={isOwner} />
          </div>
        )}
      </main>
    </div>
  );
}
