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

  try {
    const { cityId } = await request.json();

    if (typeof cityId !== "string" || !cityId) {
      return NextResponse.json(
        { error: "cityId is required" },
        { status: 400 }
      );
    }

    // RLS ("Authenticated set business city") plus a column-level grant
    // restricted to city_id enforce that this can only ever set a
    // currently-null city_id, never overwrite one, and never touch any
    // other column on the row.
    const { data: business, error } = await supabase
      .from("businesses")
      .update({ city_id: cityId })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "22P02" || error.code === "23503") {
        return NextResponse.json({ error: "Invalid cityId" }, { status: 400 });
      }
      console.error(error);
      return NextResponse.json(
        { error: "Failed to set city" },
        { status: 500 }
      );
    }
    if (!business) {
      return NextResponse.json(
        { error: "Business not found, or its city is already set" },
        { status: 404 }
      );
    }

    return NextResponse.json({ business });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
