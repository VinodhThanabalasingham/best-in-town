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
