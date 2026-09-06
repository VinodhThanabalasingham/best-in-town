import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

// Resolves a category by normalized_label, inserting it if it doesn't
// exist yet. Race-safe: if two requests insert the same normalized
// label concurrently, the loser re-reads the winner's row instead of
// erroring. topicId is only required when actually inserting a new
// category — an existing match's topic is authoritative and topicId
// is ignored in that branch.
export async function resolveCategoryId(
  supabase: SupabaseClient,
  categoryLabel: string,
  topicId?: string
): Promise<{ categoryId: string } | { error: string; status: number }> {
  const normalizedLabel = normalizeLabel(categoryLabel);

  const { data: existing, error: lookupError } = await supabase
    .from("categories")
    .select("id")
    .eq("normalized_label", normalizedLabel)
    .maybeSingle();

  if (lookupError) {
    console.error(lookupError);
    return { error: "Failed to look up category", status: 500 };
  }

  if (existing) {
    return { categoryId: existing.id };
  }

  if (!topicId) {
    return { error: "topicId is required for a new category", status: 400 };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("categories")
    .insert({
      label: categoryLabel.trim(),
      normalized_label: normalizedLabel,
      topic_id: topicId,
    })
    .select("id")
    .single();

  if (!insertError) {
    return { categoryId: inserted.id };
  }

  if (insertError.code === "23505") {
    // Lost a race with another insert of the same normalized label.
    const { data: retry, error: retryError } = await supabase
      .from("categories")
      .select("id")
      .eq("normalized_label", normalizedLabel)
      .single();
    if (retryError) {
      console.error(retryError);
      return { error: "Failed to create category", status: 500 };
    }
    return { categoryId: retry.id };
  }

  console.error(insertError);
  return { error: "Failed to create category", status: 500 };
}
