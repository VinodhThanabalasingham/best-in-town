import { autocompletePlaces } from "@/lib/places";
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

  const { input, sessionToken } = await request.json();

  if (typeof input !== "string" || input.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }
  if (typeof sessionToken !== "string" || !sessionToken) {
    return NextResponse.json(
      { error: "sessionToken is required" },
      { status: 400 }
    );
  }

  try {
    const suggestions = await autocompletePlaces(input, sessionToken);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 502 }
    );
  }
}
