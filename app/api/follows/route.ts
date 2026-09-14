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

  const { followedId } = await request.json();

  if (typeof followedId !== "string" || !followedId) {
    return NextResponse.json({ error: "followedId is required" }, { status: 400 });
  }
  if (followedId === user.id) {
    return NextResponse.json({ error: "You can't follow yourself" }, { status: 400 });
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, followed_id: followedId });

  if (error) {
    if (error.code === "23505") {
      // Already following — idempotent success.
      return NextResponse.json({ ok: true });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
