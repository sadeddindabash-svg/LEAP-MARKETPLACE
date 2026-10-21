// What the formatting buttons of the page editor do to the text (pure functions, so they can be tested without a screen). Each returns the new text and where the selection should be afterwards.
/** **bold** around the selection (or around the words "bold text"). */
export function bold(value, start, end) {
  const sel = value.slice(start, end) || "bold text"; const out = `${value.slice(0, start)}**${sel}**${value.slice(end)}`;
  return { value: out, start: start + 2, end: start + 2 + sel.length };
}
/** "## " at the start of the line the selection starts in (a second press does nothing). */
export function heading(value, start) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  if (value.startsWith("## ", lineStart)) return { value, start, end: start };
  return { value: `${value.slice(0, lineStart)}## ${value.slice(lineStart)}`, start: start + 3, end: start + 3 };
}
/** "- " at the start of every line the selection touches (lines that already have it are left alone). */
export function bulletList(value, start, end) {
  const from = value.lastIndexOf("\n", start - 1) + 1; const nl = value.indexOf("\n", end); const to = nl === -1 ? value.length : nl;
  const lines = value.slice(from, to).split("\n").map((l) => (/^[-*]\s/.test(l) ? l : `- ${l}`));
  const block = lines.join("\n"); return { value: value.slice(0, from) + block + value.slice(to), start: from, end: from + block.length };
}
/** [selected words](https://) with the address part selected, ready to be typed over. */
export function link(value, start, end) {
  const sel = value.slice(start, end) || "link text"; const before = `${value.slice(0, start)}[${sel}](`; const out = `${before}https://)${value.slice(end)}`;
  return { value: out, start: before.length, end: before.length + "https://".length };
}
