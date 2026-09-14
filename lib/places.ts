const PLACES_BASE = "https://places.googleapis.com/v1";

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  mapsUrl: string | null;
  photoName: string | null;
};

function apiKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  return key;
}

export async function autocompletePlaces(
  input: string,
  sessionToken: string
): Promise<PlaceSuggestion[]> {
  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
    },
    body: JSON.stringify({ input, sessionToken }),
  });

  if (!res.ok) {
    throw new Error(`Places autocomplete failed: ${res.status}`);
  }

  const data = await res.json();
  const suggestions = data.suggestions ?? [];

  return suggestions
    .filter((s: { placePrediction?: unknown }) => s.placePrediction)
    .map((s: {
      placePrediction: {
        placeId: string;
        structuredFormat?: {
          mainText?: { text: string };
          secondaryText?: { text: string };
        };
        text?: { text: string };
      };
    }) => {
      const p = s.placePrediction;
      return {
        placeId: p.placeId,
        primaryText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      };
    });
}

export async function getPlaceDetails(
  placeId: string,
  sessionToken: string
): Promise<PlaceDetails> {
  const res = await fetch(
    `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": "id,displayName,formattedAddress,rating,googleMapsUri,photos.name",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Place details failed: ${res.status}`);
  }

  const data = await res.json();

  return {
    placeId: data.id,
    name: data.displayName?.text ?? "",
    address: data.formattedAddress ?? null,
    rating: data.rating ?? null,
    mapsUrl: data.googleMapsUri ?? null,
    photoName: data.photos?.[0]?.name ?? null,
  };
}

export async function getPlacePhoto(
  photoName: string
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const res = await fetch(`${PLACES_BASE}/${photoName}/media?maxWidthPx=800`, {
    headers: { "X-Goog-Api-Key": apiKey() },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;

  const bytes = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { bytes, contentType };
}
