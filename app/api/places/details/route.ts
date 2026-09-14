import { getPlaceDetails, getPlacePhoto } from "@/lib/places";
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

    let photoUrl: string | null = null;
    if (details.photoName) {
      try {
        const photo = await getPlacePhoto(details.photoName);
        if (photo) {
          const { error: uploadError } = await supabase.storage
            .from("business-photos")
            .upload(placeId, photo.bytes, { contentType: photo.contentType });
          if (uploadError) {
            console.error("Failed to upload business photo", uploadError);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from("business-photos")
              .getPublicUrl(placeId);
            photoUrl = publicUrlData.publicUrl;
          }
        }
      } catch (photoErr) {
        console.error("Failed to fetch business photo", photoErr);
      }
    }

    const { data: business, error } = await supabase
      .from("businesses")
      .insert({
        place_id: details.placeId,
        name: details.name,
        address: details.address,
        rating: details.rating,
        maps_url: details.mapsUrl,
        photo_url: photoUrl,
      })
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
