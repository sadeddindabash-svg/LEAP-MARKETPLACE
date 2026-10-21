import type { ReactNode } from "react";
import Link from "@/components/LocLink";
import { parseMarkdown, type Inline } from "@/lib/miniMarkdown";

// Draws a text written with the simple formatting of lib/miniMarkdown.ts. Everything is built from React elements (never from raw HTML), so a text can only ever become paragraphs, headings, lists, bold and links.
const linkClass = "font-semibold text-navy underline underline-offset-2";
function inline(parts: Inline[]): ReactNode[] {
  return parts.map((p, i) => {
    if (p.t === "bold") return <strong key={i}>{p.text}</strong>;
    if (p.t === "text") return p.text;
    if (p.href.startsWith("/")) return <Link key={i} href={p.href} className={linkClass}>{p.text}</Link>;
    const external = /^https?:/i.test(p.href);
    return <a key={i} href={p.href} className={linkClass} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{p.text}</a>;
  });
}
export default function RichText({ source }: { source: string }) {
  return (
    <div className="text-[17px] leading-relaxed text-ink">
      {parseMarkdown(source).map((b, i) => {
        if (b.t === "h2") return <h2 key={i} className="mb-3 mt-9 text-2xl font-bold tracking-tight text-navy">{inline(b.inline)}</h2>;
        if (b.t === "h3") return <h3 key={i} className="mb-2 mt-7 text-xl font-bold text-navy">{inline(b.inline)}</h3>;
        if (b.t === "ul") return <ul key={i} className="my-4 list-disc space-y-1.5 ps-6">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
        if (b.t === "ol") return <ol key={i} className="my-4 list-decimal space-y-1.5 ps-6">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>;
        return <p key={i} className="my-4">{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l)}</span>)}</p>;
      })}
    </div>
  );
}
