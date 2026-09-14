"use client";

import { createClient } from "@/lib/supabase/client";
import { ArrowUpRight, MapPin } from "lucide-react";
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
    photo_url: string | null;
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
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
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
    <article className="elevate elevate-hover flex snap-start shrink-0 basis-[78%] flex-col rounded-xl border border-border/70 bg-popover p-4 sm:basis-[calc(50%-0.5rem)]">
      {mode === "view" && (
        <div className="aspect-[5/4] w-full overflow-hidden rounded-lg border border-border/70">
          {pick.businesses?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pick.businesses.photo_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background:
                  "linear-gradient(150deg, color-mix(in srgb, var(--tile-accent, var(--primary)) 24%, var(--card)) 0%, var(--card) 78%)",
              }}
            >
              <span
                aria-hidden="true"
                className="font-serif text-6xl leading-none"
                style={{ color: "var(--tile-accent, var(--primary))" }}
              >
                {pick.businesses?.name?.charAt(0)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 font-semibold text-foreground">
        {pick.businesses?.name}
      </div>
      {pick.businesses?.address && (
        <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{pick.businesses.address}</span>
        </p>
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
                if (value.trim()) setCategoryDropdownOpen(true);
              }}
              onFocus={() => {
                if (categoryQuery.trim()) setCategoryDropdownOpen(true);
              }}
              onBlur={() => {
                setTimeout(() => setCategoryDropdownOpen(false), 150);
              }}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            {categoryDropdownOpen && categoryQuery.trim() && categorySuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                {categorySuggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryQuery(c.label);
                        setCategoryDropdownOpen(false);
                      }}
                      className="block w-full px-2 py-1 text-left text-sm hover:bg-foreground/5"
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
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
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
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (isNewCategory && !topicId)}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
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
                setCategoryDropdownOpen(false);
              }}
              className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {pick.note && (
            <p className="mt-2 text-sm italic leading-relaxed text-foreground/80">
              {pick.note}
            </p>
          )}
          {pick.businesses?.maps_url && (
            <a
              href={pick.businesses.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-secondary underline-offset-4 hover:underline"
            >
              View on Google Maps
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
            </a>
          )}
        </>
      )}

      {isOwner && mode === "view" && (
        <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className="hover:text-foreground"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-delete")}
            className="hover:text-foreground"
          >
            Delete
          </button>
        </div>
      )}

      {mode === "confirm-delete" && (
        <div className="mt-3 space-y-2 text-xs">
          {error && <p className="text-red-600">{error}</p>}
          <p className="text-muted-foreground">Delete this pick?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              {saving ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              className="text-muted-foreground hover:text-foreground"
            >
              No
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
