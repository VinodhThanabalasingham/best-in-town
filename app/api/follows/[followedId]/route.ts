import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ followedId: string }> }
) {
  const { followedId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followed_id", followedId);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
