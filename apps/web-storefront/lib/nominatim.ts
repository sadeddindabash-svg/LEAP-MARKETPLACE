// Finding an address from the buyer's location, with the same service and the same rules as the mobile app (OpenStreetMap's Nominatim, which the app also calls straight from
// the device). It is an AID: a failure (no permission, no network, nothing found) returns null and the buyer simply types the address.
export interface SuggestedAddress { streetAddress: string; city: string; country: string }

interface NominatimReverse { address?: Record<string, string>; display_name?: string }

/** Turns Nominatim's answer into our three fields, the way the app does: house number and road as the street (else the whole display name), the first of city, town, village, county as the city. */
export function suggestionFrom(body: NominatimReverse | null | undefined): SuggestedAddress | null {
  const addr = body?.address;
  if (!addr) return null;
  const street = [addr.house_number, addr.road].filter((v) => v && v.length > 0).join(" ");
  const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? "";
  return { streetAddress: street || body?.display_name || "", city, country: addr.country ?? "" };
}

export async function reverseGeocode(latitude: number, longitude: number, fetcher: typeof fetch = fetch): Promise<SuggestedAddress | null> {
  try {
    const res = await fetcher(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return suggestionFrom((await res.json()) as NominatimReverse);
  } catch {
    return null;
  }
}

/** The buyer's position from the browser, or null when they refuse or it is not available. */
export function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { timeout: 10000, maximumAge: 60000 },
    );
  });
}
