import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PickCard from "./pick-card";

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
      "id, note, categories(id, label, topics(id, label)), businesses(id, name, address, maps_url, rating)"
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="mb-10 flex items-center gap-4">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        )}
        <div>
          <h1 className="text-2xl font-semibold">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-zinc-500">@{profile.username}</p>
        </div>
      </header>

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
    </div>
  );
}
