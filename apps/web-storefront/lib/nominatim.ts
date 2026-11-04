// Finding an address from the buyer's location, with the same service and the same rules as the mobile app (OpenStreetMap's Nominatim, which the app also calls straight from
// the device). It is an AID: a failure (no permission, no network, nothing found) returns null and the buyer simply types the address.
export interface SuggestedAddress {
  /** House number and road, then the district ("12 Al Noor St, Al Khuwair"); never the city, region, postcode or country again. */
  streetAddress: string;
  city: string;
  /** The region / province ("Riyadh Region"), empty when the map has none. */
  state: string;
  postalCode: string;
  country: string;
  /** The country's two-letter code ("SA"): the country is found by it, whatever language the names came in. */
  countryCode: string;
}

interface NominatimReverse { address?: Record<string, string>; display_name?: string }

const first = (...v: (string | undefined)[]) => v.find((x) => x && x.trim().length > 0)?.trim() ?? "";

/**
 * Turns Nominatim's answer into our fields, each piece in its own field (the same rules as the mobile app):
 *   street    house number and road, then the district (neighbourhood, suburb, quarter...) after a comma
 *   city      the first of city, town, village, municipality, county
 *   region    the first of state, region, province, state district
 *   postcode  the postcode
 * With no road and no district the street is what is left of the full name once the city, region, postcode and country are taken out (never the whole line again).
 */
export function suggestionFrom(body: NominatimReverse | null | undefined, lang: "en" | "ar" = "en"): SuggestedAddress | null {
  const addr = body?.address;
  if (!addr) return null;
  const sep = lang === "ar" ? "، " : ", ";
  const city = first(addr.city, addr.town, addr.village, addr.municipality, addr.county);
  const state = first(addr.state, addr.region, addr.province, addr.state_district);
  const postalCode = first(addr.postcode);
  const country = first(addr.country);
  const road = [addr.house_number, addr.road].filter((v) => v && v.trim().length > 0).join(" ");
  const district = first(addr.neighbourhood, addr.suburb, addr.quarter, addr.city_district, addr.residential, addr.hamlet);
  const parts = [road, district !== city ? district : ""].filter((v) => v.length > 0);
  let streetAddress = parts.join(sep);
  if (!streetAddress && body?.display_name) {
    const taken = new Set([city, state, postalCode, country, addr.county, addr.municipality, addr.state_district].filter(Boolean).map((v) => v!.trim().toLowerCase()));
    streetAddress = body.display_name.split(/[,،]\s*/).map((p) => p.trim()).filter((p) => p && !taken.has(p.toLowerCase())).slice(0, 2).join(sep);
  }
  return { streetAddress, city, state, postalCode, country, countryCode: first(addr.country_code).toUpperCase() };
}

/** The address at a position, in the page's language, as precise as the map has it (zoom 18: the building). Null on any failure: it is only an aid. */
export async function reverseGeocode(latitude: number, longitude: number, fetcher: typeof fetch = fetch, lang: "en" | "ar" = "en"): Promise<SuggestedAddress | null> {
  try {
    const res = await fetcher(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18&accept-language=${lang}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return suggestionFrom((await res.json()) as NominatimReverse, lang);
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
