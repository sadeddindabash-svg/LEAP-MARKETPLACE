// The simple formatting of the six pages, for the preview in the admin portal. This is a COPY of apps/web-storefront/lib/miniMarkdown.ts (the website draws the real page from that one); a test in the
// storefront reads both with the same texts and checks they agree.
export function safeHref(href) {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(h)) return h;
  if (/^\/(?!\/)/.test(h)) return h;
  return null;
}
// The patterns are BOUNDED (bold up to 500 characters, link words up to 300, address up to 500): a text of one repeated marker can then never make the search slow.
export function parseInline(text) {
  const out = []; const re = /\*\*([^*]{1,500})\*\*|\[([^\]]{1,300})\]\(([^)\s]{1,500})\)/g; let last = 0; let m;
  const push = (s) => { if (s) out.push({ t: "text", text: s }); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push({ t: "bold", text: m[1] });
    else { const href = safeHref(m[3]); if (href) out.push({ t: "link", text: m[2], href }); else push(m[2]); }
    last = m.index + m[0].length;
  }
  push(text.slice(last));
  return out;
}
export function parseMarkdown(source) {
  const blocks = []; let para = null; let list = null;
  const close = () => { if (para) blocks.push({ t: "p", lines: para }); if (list) blocks.push(list); para = null; list = null; };
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim(); let m;
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
