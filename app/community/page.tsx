import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default async function CommunityPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .order("username");

  const { data: picks } = await supabase.from("picks").select("profile_id");

  const pickCounts = new Map<string, number>();
  for (const pick of picks ?? []) {
    pickCounts.set(pick.profile_id, (pickCounts.get(pick.profile_id) ?? 0) + 1);
  }

  return (
    <div className="min-h-screen">
      <main className="above-grain mx-auto max-w-4xl px-6 pb-24 pt-10 md:px-10 md:pt-14">
        <h1 className="font-serif text-3xl tracking-tight text-foreground md:text-4xl">
          Community
        </h1>
        <p className="mt-2 text-muted-foreground">
          Everyone sharing their picks on Best In Town.
        </p>

        {!profiles || profiles.length === 0 ? (
          <p className="mt-10 text-muted-foreground">No profiles yet.</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {profiles.map((profile) => {
              const displayName = profile.display_name || profile.username;
              const count = pickCounts.get(profile.id) ?? 0;
              return (
                <Link
                  key={profile.id}
                  href={`/${profile.username}`}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
                >
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-serif text-primary"
                    >
                      {initials(displayName)}
                    </div>
                  )}
                  <div>
                    <div className="font-serif text-lg text-foreground">
                      {displayName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{profile.username} &middot; {count}{" "}
                      {count === 1 ? "pick" : "picks"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
