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
