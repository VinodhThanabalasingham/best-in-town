import { createClient } from "@/lib/supabase/server";
import { ArrowUpRight, MapPin } from "lucide-react";
import Link from "next/link";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

type PickRow = {
  profile_id: string;
  businesses: { name: string } | null;
};

export default async function CommunityPage() {
  const supabase = await createClient();

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
            {profiles.map((profile, index) => {
              const displayName = profile.display_name || profile.username;
              const count = pickCounts.get(profile.id) ?? 0;
              const topPicks = topPickNames.get(profile.id) ?? [];
              const accent = index % 2 === 0 ? "primary" : "accent";

              return (
                <Link
                  key={profile.id}
                  href={`/${profile.username}`}
                  className="elevate elevate-hover group flex flex-col gap-5 rounded-3xl border border-border/70 bg-card p-6"
                >
                  <div className="flex items-start justify-between">
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
                        <p className="text-sm text-muted-foreground">
                          @{profile.username}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight
                      className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <MapPin aria-hidden="true" className="h-3 w-3" />
                      {count} {count === 1 ? "pick" : "picks"}
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
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
