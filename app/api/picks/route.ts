import { resolveCategoryId } from "@/lib/categories";
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

  const { businessId, categoryLabel, note } = await request.json();

  if (typeof businessId !== "string" || !businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }
  if (typeof categoryLabel !== "string" || !categoryLabel.trim()) {
    return NextResponse.json({ error: "categoryLabel is required" }, { status: 400 });
  }

  const resolved = await resolveCategoryId(supabase, categoryLabel);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 500 });
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
    console.error(pickError);
    return NextResponse.json({ error: "Failed to save pick" }, { status: 500 });
  }

  return NextResponse.json({ pick });
}
