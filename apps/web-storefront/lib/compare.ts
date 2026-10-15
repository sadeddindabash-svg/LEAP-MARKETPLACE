// Compare puts 2 to 4 parts side by side (the mobile app compares 2 to 4). The parts are named in the address (?ids=a,b,c), so a comparison can be shared or bookmarked.
export const COMPARE_MIN = 2;
export const COMPARE_MAX = 4;

/** The ids in ?ids=a,b,c: trimmed, without blanks or duplicates, at most four. */
export function parseIds(raw: string | undefined): string[] {
  return [...new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, COMPARE_MAX);
}

/** The address of a comparison of these parts. */
export function compareHref(ids: string[]): string {
  return `/compare?ids=${ids.slice(0, COMPARE_MAX).map(encodeURIComponent).join(",")}`;
}
