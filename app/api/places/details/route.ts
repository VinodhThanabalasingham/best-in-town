import { getPlaceDetails } from "@/lib/places";
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

  const { placeId, sessionToken } = await request.json();

  if (typeof placeId !== "string" || !placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }
  if (typeof sessionToken !== "string" || !sessionToken) {
    return NextResponse.json(
      { error: "sessionToken is required" },
      { status: 400 }
    );
  }

  try {
    const { data: existingBusiness, error: lookupError } = await supabase
      .from("businesses")
      .select()
      .eq("place_id", placeId)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existingBusiness) {
      return NextResponse.json({ business: existingBusiness });
    }

    const details = await getPlaceDetails(placeId, sessionToken);

    const { data: business, error } = await supabase
      .from("businesses")
      .upsert(
        {
          place_id: details.placeId,
          name: details.name,
          address: details.address,
          rating: details.rating,
          maps_url: details.mapsUrl,
        },
        { onConflict: "place_id" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ business });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch place details" },
      { status: 502 }
    );
  }
}
