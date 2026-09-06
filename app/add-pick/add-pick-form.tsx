"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";

type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

type Business = {
  id: string;
  name: string;
  address: string | null;
};

type CategorySuggestion = {
  id: string;
  label: string;
};

type TopicOption = {
  id: string;
  label: string;
};

function newSessionToken() {
  return crypto.randomUUID();
}

export default function AddPickForm() {
  const [sessionToken, setSessionToken] = useState(newSessionToken);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  const [business, setBusiness] = useState<Business | null>(null);

  const [categoryQuery, setCategoryQuery] = useState("");
  const [categorySuggestions, setCategorySuggestions] = useState<
    CategorySuggestion[]
  >([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [note, setNote] = useState("");
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicId, setTopicId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced Places Autocomplete (~300ms), min 2 chars.
  useEffect(() => {
    if (business) return; // already selected, don't keep searching
    if (query.trim().length < 2) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: query, sessionToken }),
        });
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, sessionToken, business]);

  // Lighter debounce for category suggestions (direct Supabase read).
  useEffect(() => {
    if (!categoryQuery.trim()) return;
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
  }, [categoryQuery]);

  // Curated topic list, fetched once — small and static.
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("topics")
      .select("id, label")
      .order("label")
      .then(({ data }) => setTopics(data ?? []));
  }, []);

  async function selectPlace(suggestion: PlaceSuggestion) {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/places/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: suggestion.placeId, sessionToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load business");
      setBusiness(data.business);
      setSuggestions([]);
      setQuery(data.business.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSearching(false);
    }
  }

  function reset() {
    setSessionToken(newSessionToken());
    setQuery("");
    setSuggestions([]);
    setBusiness(null);
    setCategoryQuery("");
    setCategorySuggestions([]);
    setCategoryDropdownOpen(false);
    setNote("");
    setTopicId("");
    setError(null);
    setSaved(false);
  }

  const matchedCategory = categorySuggestions.find(
    (c) => c.label.toLowerCase() === categoryQuery.trim().toLowerCase()
  );
  const isNewCategory = categoryQuery.trim().length > 0 && !matchedCategory;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !categoryQuery.trim()) return;
    if (isNewCategory && !topicId) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          categoryLabel: categoryQuery.trim(),
          note,
          ...(isNewCategory ? { topicId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save pick");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="space-y-4">
        <p className="text-lg">
          Saved <span className="font-medium">{business?.name}</span> under{" "}
          <span className="font-medium">{categoryQuery.trim()}</span>.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Add another pick
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="relative">
        <input
          type="text"
          placeholder="Search for a business"
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            setBusiness(null);
            if (value.trim().length < 2) setSuggestions([]);
          }}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-black">
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onClick={() => selectPlace(s)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <div className="font-medium">{s.primaryText}</div>
                  <div className="text-zinc-500">{s.secondaryText}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {business && (
        <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <div className="font-medium">{business.name}</div>
          {business.address && (
            <div className="text-zinc-500">{business.address}</div>
          )}
        </div>
      )}

      {business && (
        <>
          <div className="relative">
            <input
              type="text"
              required
              placeholder="Category (e.g. Best coffee)"
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
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
            />
            {categoryDropdownOpen && categoryQuery.trim() && (
              <ul className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-black">
                {categorySuggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryQuery(c.label);
                        setCategoryDropdownOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      {c.label}
                    </button>
                  </li>
                ))}
                {!categorySuggestions.some(
                  (c) => c.label.toLowerCase() === categoryQuery.trim().toLowerCase()
                ) && (
                  <li>
                    <div className="px-3 py-2 text-sm text-zinc-500">
                      Create &ldquo;{categoryQuery.trim()}&rdquo;
                    </div>
                  </li>
                )}
              </ul>
            )}
          </div>

          {isNewCategory && (
            <select
              required
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-black"
            >
              <option value="">Choose a topic for this new category&hellip;</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}

          <textarea
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
            rows={3}
          />
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {business && (
        <button
          type="submit"
          disabled={saving || !categoryQuery.trim() || (isNewCategory && !topicId)}
          className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? "Saving..." : "Save pick"}
        </button>
      )}

      {searching && !business && (
        <p className="text-sm text-zinc-500">Searching...</p>
      )}
    </form>
  );
}
