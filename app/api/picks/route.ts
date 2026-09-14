import { resolveCategoryId } from "@/lib/categories";
import { findConflictingPickBusinessName } from "@/lib/picks";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId, categoryLabel, note, topicId } = await request.json();

  if (typeof businessId !== "string" || !businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }
  if (typeof categoryLabel !== "string" || !categoryLabel.trim()) {
    return NextResponse.json({ error: "categoryLabel is required" }, { status: 400 });
  }

  const resolved = await resolveCategoryId(
    supabase,
    categoryLabel,
    typeof topicId === "string" ? topicId : undefined
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { data: pick, error: pickError } = await supabase
    .from("picks")
    .insert({
      profile_id: user.id,
      business_id: businessId,
      category_id: resolved.categoryId,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .select()
    .single();

  if (pickError) {
    if (pickError.code === "23505") {
      const existingBusinessName = await findConflictingPickBusinessName(
        supabase,
        user.id,
        resolved.categoryId
      );
      const suffix = existingBusinessName ? ` (${existingBusinessName})` : "";
      return NextResponse.json(
        {
          error: `You already have a pick for ${categoryLabel.trim()}${suffix}. Edit that one instead of adding a new one.`,
        },
        { status: 409 }
      );
    }
    console.error(pickError);
    return NextResponse.json({ error: "Failed to save pick" }, { status: 500 });
  }

  return NextResponse.json({ pick });
}
