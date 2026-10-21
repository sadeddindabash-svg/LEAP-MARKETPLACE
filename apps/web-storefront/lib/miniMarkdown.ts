// The simple formatting the six pages are written with (and nothing else, so what an admin types can never become HTML or a script):
//   ## Heading   ### Smaller heading   (a blank line starts a new paragraph; a single line break stays a line break)
//   - item   * item   (a bullet list)       1. item   (a numbered list)       **bold**       [words](https://address)
// A link is only kept when its address is https:, http:, mailto:, tel: or a page of this website (/something); any other address leaves just its words.
// The admin portal has a copy of this file (apps/admin-dashboard/src/miniMarkdown.js) for the preview; a test checks the two read every text the same way.
export type Inline = { t: "text"; text: string } | { t: "bold"; text: string } | { t: "link"; text: string; href: string };
export type Block = { t: "h2"; inline: Inline[] } | { t: "h3"; inline: Inline[] } | { t: "p"; lines: Inline[][] } | { t: "ul"; items: Inline[][] } | { t: "ol"; items: Inline[][] };

export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(h)) return h;
  if (/^\/(?!\/)/.test(h)) return h;
  return null;
}
// The patterns are BOUNDED (bold up to 500 characters, link words up to 300, address up to 500): a text of one repeated marker can then never make the search slow.
export function parseInline(text: string): Inline[] {
  const out: Inline[] = []; const re = /\*\*([^*]{1,500})\*\*|\[([^\]]{1,300})\]\(([^)\s]{1,500})\)/g; let last = 0; let m: RegExpExecArray | null;
  const push = (s: string) => { if (s) out.push({ t: "text", text: s }); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push({ t: "bold", text: m[1] });
    else { const href = safeHref(m[3]); if (href) out.push({ t: "link", text: m[2], href }); else push(m[2]); }
    last = m.index + m[0].length;
  }
  push(text.slice(last));
  return out;
}
export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []; let para: Inline[][] | null = null; let list: { t: "ul" | "ol"; items: Inline[][] } | null = null;
  const close = () => { if (para) blocks.push({ t: "p", lines: para }); if (list) blocks.push(list); para = null; list = null; };
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim(); let m: RegExpExecArray | null;
    if (line === "") { close(); continue; }
    if ((m = /^(#{3,})\s+(.*)$/.exec(line))) { close(); blocks.push({ t: "h3", inline: parseInline(m[2]) }); continue; }
    if ((m = /^#{1,2}\s+(.*)$/.exec(line))) { close(); blocks.push({ t: "h2", inline: parseInline(m[1]) }); continue; }
    if ((m = /^[-*]\s+(.*)$/.exec(line))) { if (!list || list.t !== "ul") { close(); list = { t: "ul", items: [] }; } list.items.push(parseInline(m[1])); continue; }
    if ((m = /^\d+[.)]\s+(.*)$/.exec(line))) { if (!list || list.t !== "ol") { close(); list = { t: "ol", items: [] }; } list.items.push(parseInline(m[1])); continue; }
    if (list) close();
    if (!para) para = []; para.push(parseInline(line));
  }
  close();
  return blocks;
}
/** The words of a text without its formatting (for a page's search-result description). */
export function plainText(source: string): string {
  return parseMarkdown(source).flatMap((b) => (b.t === "p" ? b.lines : b.t === "ul" || b.t === "ol" ? b.items : [b.inline])).map((l) => l.map((i) => i.text).join("")).join(" ").replace(/\s+/g, " ").trim();
}
