"use client";

import CategoryRow from "@/components/category-row";
import { useMemo, useState } from "react";
import PickCard from "./pick-card";

type CityInfo = { id: string; label: string };

type PickWithCity = {
  id: string;
  note: string | null;
  categories: { id: string; label: string } | null;
  businesses: {
    id: string;
    name: string;
    address: string | null;
    maps_url: string | null;
    rating: number | null;
    cities: CityInfo | null;
  } | null;
};

type CategoryGroup = { label: string; picks: PickWithCity[] };
type TopicGroup = { label: string; categories: CategoryGroup[] };

export default function CityFilterSection({
  topicGroups,
  isOwner,
}: {
  topicGroups: TopicGroup[];
  isOwner: boolean;
}) {
  const cities = useMemo(() => {
    const seen = new Map<string, string>();
    for (const topic of topicGroups) {
      for (const category of topic.categories) {
        for (const pick of category.picks) {
          const city = pick.businesses?.cities;
          if (city) seen.set(city.id, city.label);
        }
      }
    }
    return [...seen.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [topicGroups]);

  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  const filteredTopicGroups = useMemo(() => {
    const filtered = selectedCityId
      ? topicGroups
          .map((topic) => ({
            label: topic.label,
            categories: topic.categories
              .map((category) => ({
                label: category.label,
                picks: category.picks.filter(
                  (pick) => pick.businesses?.cities?.id === selectedCityId
                ),
              }))
              .filter((category) => category.picks.length > 0),
          }))
          .filter((topic) => topic.categories.length > 0)
      : topicGroups;

    const counts = filtered.map((topic) => topic.categories.length);
    return filtered.map((topic, topicIndex) => {
      const offset = counts
        .slice(0, topicIndex)
        .reduce((sum, n) => sum + n, 0);
      const categories = topic.categories.map((category, i) => ({
        ...category,
        accent: ((offset + i) % 2 === 0 ? "primary" : "secondary") as
          | "primary"
          | "secondary",
      }));
      return { label: topic.label, categories };
    });
  }, [topicGroups, selectedCityId]);

  return (
    <div>
      {cities.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCityId(null)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              selectedCityId === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            All cities
          </button>
          {cities.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => setSelectedCityId(city.id)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                selectedCityId === city.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {city.label}
            </button>
          ))}
        </div>
      )}

      {filteredTopicGroups.length === 0 ? (
        <p className="text-muted-foreground">No picks in this city yet.</p>
      ) : (
        <div className="space-y-12">
          {filteredTopicGroups.map((topic) => (
            <section key={topic.label}>
              <h2 className="font-serif text-2xl text-foreground">
                {topic.label}
              </h2>
              <div>
                {topic.categories.map((shelf) => (
                  <CategoryRow
                    key={shelf.label}
                    label={shelf.label}
                    count={shelf.picks.length}
                    accent={shelf.accent}
                  >
                    {shelf.picks.map((pick) => (
                      <PickCard key={pick.id} pick={pick} isOwner={isOwner} />
                    ))}
                  </CategoryRow>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
