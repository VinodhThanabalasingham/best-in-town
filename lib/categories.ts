import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

// Resolves a category by normalized_label, inserting it if it doesn't
// exist yet. Race-safe: if two requests insert the same normalized
// label concurrently, the loser re-reads the winner's row instead of
// erroring.
export async function resolveCategoryId(
  supabase: SupabaseClient,
  categoryLabel: string
): Promise<{ categoryId: string } | { error: string }> {
  const normalizedLabel = normalizeLabel(categoryLabel);

  const { data: existing, error: lookupError } = await supabase
    .from("categories")
    .select("id")
    .eq("normalized_label", normalizedLabel)
    .maybeSingle();

  if (lookupError) {
    console.error(lookupError);
    return { error: "Failed to look up category" };
  }

  if (existing) {
    return { categoryId: existing.id };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("categories")
    .insert({ label: categoryLabel.trim(), normalized_label: normalizedLabel })
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
      return { error: "Failed to create category" };
    }
    return { categoryId: retry.id };
  }

  console.error(insertError);
  return { error: "Failed to create category" };
}
