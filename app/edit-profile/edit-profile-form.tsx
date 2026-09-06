"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

type Profile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile.avatar_url
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a PNG, JPEG, or WEBP image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be under 2MB.");
      return;
    }

    setError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      let avatarUrl = profile.avatar_url;

      if (avatarFile) {
        const path = `${user.id}/avatar`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, {
            upsert: true,
            contentType: avatarFile.type,
          });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        // Cache-bust since the path is stable across re-uploads.
        avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() || null, avatar_url: avatarUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;

      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        {avatarPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarPreview}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="text-sm"
        />
      </div>

      <input
        type="text"
        placeholder="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
