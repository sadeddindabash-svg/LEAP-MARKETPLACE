import React from "react";
import { C, body } from "./theme";
import { parseMarkdown } from "./miniMarkdown";

// How a page's text will look on the website (the same reading of the text as the website's, drawn simply). Built from elements only: a text can never become HTML or a script here either.
const inline = (parts) => parts.map((p, i) => (p.t === "bold" ? <strong key={i}>{p.text}</strong> : p.t === "link" ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" style={{ color: C.ink, fontWeight: 600, textDecoration: "underline" }}>{p.text}</a> : <React.Fragment key={i}>{p.text}</React.Fragment>));
export default function MiniPreview({ source, dir = "ltr" }) {
  const blocks = parseMarkdown(source || "");
  if (blocks.length === 0) return <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Nothing written yet.</div>;
  return (
    <div dir={dir} data-testid="page-preview" style={{ ...body, fontSize: 13.5, lineHeight: 1.6, color: C.ink }}>
      {blocks.map((b, i) => b.t === "h2" ? <h4 key={i} style={{ fontSize: 16, margin: "14px 0 6px" }}>{inline(b.inline)}</h4>
        : b.t === "h3" ? <h5 key={i} style={{ fontSize: 14, margin: "10px 0 4px" }}>{inline(b.inline)}</h5>
        : b.t === "ul" ? <ul key={i} style={{ margin: "8px 0", paddingInlineStart: 22 }}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>
        : b.t === "ol" ? <ol key={i} style={{ margin: "8px 0", paddingInlineStart: 22 }}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>
        : <p key={i} style={{ margin: "8px 0" }}>{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l)}</span>)}</p>)}
    </div>
  );
}
