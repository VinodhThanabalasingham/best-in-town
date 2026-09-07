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
  city_id: string | null;
};

type CategorySuggestion = {
  id: string;
  label: string;
};

type TopicOption = {
  id: string;
  label: string;
};

type CityOption = {
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
  const [cities, setCities] = useState<CityOption[]>([]);
  const [settingCity, setSettingCity] = useState(false);

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

  // Curated city list, fetched once — small and static.
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("cities")
      .select("id, label")
      .order("label")
      .then(({ data }) => setCities(data ?? []));
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

  async function handleCityChange(cityId: string) {
    if (!business) return;
    setSettingCity(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to set city");
      setBusiness(data.business);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSettingCity(false);
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
    if (!business || !categoryQuery.trim() || !business.city_id) return;
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
      <div className="space-y-6">
        <p className="font-serif text-lg italic leading-relaxed text-foreground/80">
          Saved <span className="not-italic font-medium">{business?.name}</span>{" "}
          under{" "}
          <span className="not-italic font-medium">{categoryQuery.trim()}</span>.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-sm border border-input bg-popover px-4 py-2 text-sm text-foreground hover:border-primary"
        >
          Add another pick
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-10">
      {/* Step 1 — search */}
      <section>
        <label htmlFor="search" className="font-serif text-lg text-foreground">
          Which place?
        </label>
        <div className="relative mt-3">
          <input
            id="search"
            placeholder="Search a local business…"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              setBusiness(null);
              if (value.trim().length < 2) setSuggestions([]);
            }}
            autoComplete="off"
            className="w-full rounded-sm border border-input bg-popover px-4 py-3 text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {suggestions.length > 0 && (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-sm border border-border bg-popover">
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    onClick={() => selectPlace(s)}
                    className="block w-full px-4 py-3 text-left transition-colors hover:bg-primary/8"
                  >
                    <span className="block text-foreground">{s.primaryText}</span>
                    <span className="block text-sm text-muted-foreground">
                      {s.secondaryText}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {business && (
          <div className="mt-3 rounded-sm border border-secondary/50 bg-secondary/8 px-4 py-4">
            <span className="block font-serif text-lg text-foreground">
              {business.name}
            </span>
            {business.address && (
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {business.address}
              </span>
            )}
          </div>
        )}

        {searching && !business && (
          <p className="mt-2 text-sm text-muted-foreground">Searching…</p>
        )}
      </section>

      {/* Step 2 — city */}
      {business && !business.city_id && (
        <section>
          <label htmlFor="city" className="font-serif text-lg text-foreground">
            Which city is this in?
          </label>
          <select
            id="city"
            required
            value=""
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={settingCity}
            className="mt-3 w-full rounded-sm border border-input bg-popover px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">
              {settingCity ? "Saving city…" : "Choose a city…"}
            </option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </section>
      )}

      {/* Step 3 — category */}
      {business && (
        <section>
          <label htmlFor="category" className="font-serif text-lg text-foreground">
            On which shelf?
          </label>
          <div className="relative mt-3">
            <input
              id="category"
              required
              placeholder="Choose a shelf, or name a new one…"
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
              autoComplete="off"
              className="w-full rounded-sm border border-input bg-popover px-4 py-3 text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {categoryDropdownOpen && categoryQuery.trim() && (
              <div className="mt-2 overflow-hidden rounded-sm border border-border bg-popover">
                {categorySuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategoryQuery(c.label);
                      setCategoryDropdownOpen(false);
                    }}
                    className="block w-full border-b border-border px-4 py-3 text-left text-foreground transition-colors last:border-b-0 hover:bg-secondary/10"
                  >
                    {c.label}
                  </button>
                ))}
                {isNewCategory && (
                  <div className="block w-full bg-primary/8 px-4 py-4 text-left">
                    <span className="text-xs uppercase tracking-[0.16em] text-primary">
                      Start a new shelf
                    </span>
                    <span className="mt-1 block font-serif text-lg italic text-foreground">
                      &ldquo;{categoryQuery.trim()}&rdquo;
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {isNewCategory && (
            <select
              required
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="mt-3 w-full rounded-sm border border-input bg-popover px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Choose a topic for this new shelf&hellip;</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </section>
      )}

      {/* Step 4 — note */}
      {business && (
        <section>
          <label htmlFor="note" className="font-serif text-lg text-foreground">
            A word on it{" "}
            <span className="text-sm font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Order the roll. Sit by the window. Go before ten."
            className="mt-3 w-full resize-none rounded-sm border border-input bg-popover px-4 py-3 leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </section>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {business && (
        <button
          type="submit"
          disabled={
            saving ||
            !categoryQuery.trim() ||
            !business.city_id ||
            (isNewCategory && !topicId)
          }
          className="w-full rounded-sm bg-primary px-6 py-4 font-serif text-lg text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save pick"}
        </button>
      )}
    </form>
  );
}
