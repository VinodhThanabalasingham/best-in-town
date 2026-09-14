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
