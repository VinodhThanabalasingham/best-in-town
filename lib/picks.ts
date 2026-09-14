import type { SupabaseClient } from "@supabase/supabase-js";

// Looks up the business name of the pick that already occupies a
// given (profile, category) pair, for a friendly conflict message
// when the picks_profile_category_unique constraint fires.
// `excludePickId` skips the pick currently being edited, so editing a
// pick's category to itself doesn't self-conflict.
export async function findConflictingPickBusinessName(
  supabase: SupabaseClient,
  profileId: string,
  categoryId: string,
  excludePickId?: string
): Promise<string | null> {
  let query = supabase
    .from("picks")
    .select("businesses(name)")
    .eq("profile_id", profileId)
    .eq("category_id", categoryId);

  if (excludePickId) {
    query = query.neq("id", excludePickId);
  }

  const { data } = await query.maybeSingle();
  const businesses = data?.businesses as { name: string } | null | undefined;
  return businesses?.name ?? null;
}
