"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Pick = {
  id: string;
  note: string | null;
  categories: { id: string; label: string } | null;
  businesses: {
    name: string;
    address: string | null;
    maps_url: string | null;
  } | null;
};

type CategorySuggestion = {
  id: string;
  label: string;
};

type TopicOption = {
  id: string;
  label: string;
};

export default function PickCard({
  pick,
  isOwner,
}: {
  pick: Pick;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [categoryQuery, setCategoryQuery] = useState(pick.categories?.label ?? "");
  const [categorySuggestions, setCategorySuggestions] = useState<
    CategorySuggestion[]
  >([]);
  const [note, setNote] = useState(pick.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicId, setTopicId] = useState("");

  useEffect(() => {
    if (mode !== "edit" || !categoryQuery.trim()) return;
    const timeout = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("categories")
        .select("id, label")
        .ilike("label", `%${categoryQuery.trim()}%`)
        .limit(5);
      setCategorySuggestions(data ?? []);
    }, 200);
    return () => clearTimeout(timeout);
  }, [categoryQuery, mode]);

  // Curated topic list, fetched lazily the first time edit mode opens.
  useEffect(() => {
    if (mode !== "edit" || topics.length > 0) return;
    const supabase = createClient();
    supabase
      .from("topics")
      .select("id, label")
      .order("label")
      .then(({ data }) => setTopics(data ?? []));
  }, [mode, topics.length]);

  const matchedCategory = categorySuggestions.find(
    (c) => c.label.toLowerCase() === categoryQuery.trim().toLowerCase()
  );
  const isNewCategory = categoryQuery.trim().length > 0 && !matchedCategory;

  async function handleSave() {
    if (!categoryQuery.trim()) return;
    if (isNewCategory && !topicId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/picks/${pick.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryLabel: categoryQuery.trim(),
          note,
          ...(isNewCategory ? { topicId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setMode("view");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/picks/${pick.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="w-64 shrink-0 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="font-medium">{pick.businesses?.name}</div>
      {pick.businesses?.address && (
        <div className="text-sm text-zinc-500">{pick.businesses.address}</div>
      )}

      {mode === "edit" ? (
        <div className="mt-2 space-y-2">
          <div className="relative">
            <input
              type="text"
              value={categoryQuery}
              onChange={(e) => {
                const value = e.target.value;
                setCategoryQuery(value);
                if (!value.trim()) setCategorySuggestions([]);
              }}
              className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
            />
            {categorySuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-black">
                {categorySuggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setCategoryQuery(c.label)}
                      className="block w-full px-2 py-1 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {isNewCategory && (
            <select
              required
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
            >
              <option value="">Choose a topic&hellip;</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (isNewCategory && !topicId)}
              className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setCategoryQuery(pick.categories?.label ?? "");
                setNote(pick.note ?? "");
                setTopicId("");
                setError(null);
              }}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {pick.note && <p className="mt-2 text-sm">{pick.note}</p>}
          {pick.businesses?.maps_url && (
            <a
              href={pick.businesses.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium underline"
            >
              View on Google Maps &rarr;
            </a>
          )}
        </>
      )}

      {isOwner && mode === "view" && (
        <div className="mt-3 flex gap-3 text-xs text-zinc-500">
          <button type="button" onClick={() => setMode("edit")} className="underline">
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-delete")}
            className="underline"
          >
            Delete
          </button>
        </div>
      )}

      {mode === "confirm-delete" && (
        <div className="mt-3 space-y-2 text-xs">
          {error && <p className="text-red-600">{error}</p>}
          <p>Delete this pick?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="font-medium text-red-600 underline disabled:opacity-50"
            >
              {saving ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              className="underline"
            >
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
