// The rotating suggestions in the header search box. The FIRST one is the box's normal sentence (so the box looks exactly as before until it first slides); the others are examples of what can be typed.
export const SEARCH_HINT_KEYS = ["search_hint_1", "search_hint_2", "search_hint_3", "search_hint_4"] as const;
export const ROTATE_MS = 3000;       // how long each suggestion stays
export const SLIDE_MS = 500;         // how long the slide to the next one takes
/** The suggestions in the visitor's language: the normal sentence first, then the examples. `t` is the translate function. */
export function searchSuggestions(t: (key: never) => string): string[] {
  const say = t as unknown as (key: string) => string;
  return [say("search_placeholder"), ...SEARCH_HINT_KEYS.map((k) => say(k))];
}
