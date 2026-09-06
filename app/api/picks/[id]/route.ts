import { resolveCategoryId } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { categoryLabel, note } = await request.json();

  if (typeof categoryLabel !== "string" || !categoryLabel.trim()) {
    return NextResponse.json({ error: "categoryLabel is required" }, { status: 400 });
  }

  const resolved = await resolveCategoryId(supabase, categoryLabel);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 500 });
  }

  // RLS ("Users update own picks") enforces that this only affects a
  // row the caller owns; a non-owner's request simply matches zero rows.
  const { data: pick, error } = await supabase
    .from("picks")
    .update({
      category_id: resolved.categoryId,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update pick" }, { status: 500 });
  }
  if (!pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  return NextResponse.json({ pick });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS ("Users delete own picks") enforces ownership.
  const { data: pick, error } = await supabase
    .from("picks")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete pick" }, { status: 500 });
  }
  if (!pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
