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
                canFollow={user != null && user.id !== profile.id}
                isFollowing={followingIds.has(profile.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
