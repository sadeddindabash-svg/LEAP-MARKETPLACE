import React, { useState, useEffect, useRef } from "react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken } from "./auth";
import { fetchFooter, fetchPage, savePage, PAGE_KEYS, PAGE_NAMES } from "./footerApi";
import MiniPreview from "./MiniPreview";
import { bold, heading, bulletList, link } from "./pageEditorFormat";

// "Pages": the six pages the footer's "Useful links" open INSIDE the website (About us, Terms & Conditions, Delivery & Shipping, Refund, Privacy Policy, Cancellation). Each has a title and a text, in English and in
// Arabic. Until a page has text, its footer link still opens the same page on the old website. The text is written with simple formatting (headings, lists, bold, links); the preview shows how it will look.
const MAX = { title: 120, body: 60000 };
const field = { ...body, width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: C.line, color: C.ink, background: "#fff" };
const button = { ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: C.line, background: "#fff", color: C.ink };
const primary = { ...button, background: C.ink, color: "#fff", borderColor: C.ink };
const draftOf = (p) => ({ title: { en: p?.title?.en || "", ar: p?.title?.ar || "" }, body: { en: p?.body?.en || "", ar: p?.body?.ar || "" } });
const same = (a, b) => ["title", "body"].every((n) => ["en", "ar"].every((l) => a[n][l].trim() === b[n][l].trim()));
const when = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function LegalPagesSection({ onSessionExpired }) {
  const [active, setActive] = useState(PAGE_KEYS[0]); const [lang, setLang] = useState("en");
  const [pages, setPages] = useState({}); const [drafts, setDrafts] = useState({}); const [flags, setFlags] = useState({});
  const [error, setError] = useState(null); const [message, setMessage] = useState(null); const [saving, setSaving] = useState(false);
  const area = useRef(null);

  useEffect(() => { fetchFooter().then((d) => setFlags(d.pages)).catch(() => {}); }, []);
  useEffect(() => {
    if (pages[active]) return; let live = true;
    fetchPage(active).then((p) => { if (!live) return; setPages((x) => ({ ...x, [active]: p })); setDrafts((x) => ({ ...x, [active]: draftOf(p) })); setFlags((f) => ({ ...f, [active]: p.hasContent })); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [active, pages]);

  const page = pages[active]; const draft = drafts[active];
  const unsaved = (k) => Boolean(pages[k] && drafts[k] && !same(drafts[k], draftOf(pages[k])));
  const edit = (n, l, v) => { setMessage(null); setDrafts((x) => ({ ...x, [active]: { ...x[active], [n]: { ...x[active][n], [l]: v } } })); };
  const format = (fn) => {
    const el = area.current; if (!el) return; const r = fn(el.value, el.selectionStart, el.selectionEnd); edit("body", lang, r.value);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.start, r.end); });
  };
  const save = async () => {
    setSaving(true); setError(null); setMessage(null);
    try {
      const saved = await savePage(getStoredToken(), active, { title: draft.title, body: draft.body });
      setPages((x) => ({ ...x, [active]: saved })); setDrafts((x) => ({ ...x, [active]: draftOf(saved) })); setFlags((f) => ({ ...f, [active]: saved.hasContent }));
      setMessage(saved.hasContent ? `Saved. The footer link now opens this page inside the website (within about a minute).` : `Saved. This page has no text, so its footer link still opens the old website.`);
    } catch (err) { if (err instanceof SessionExpiredError) onSessionExpired?.(); else setError(err.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ flex: 1, minWidth: 420, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
      <h2 style={{ ...body, fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>Pages</h2>
      <p style={{ ...body, fontSize: 12.5, color: C.muted, margin: "6px 0 12px", lineHeight: 1.5 }}>The six pages the footer's "Useful links" open inside the website. Until a page has text, its link still opens the same page on the old website.</p>
      <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {PAGE_KEYS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={k === active} onClick={() => { setActive(k); setError(null); setMessage(null); }} style={k === active ? primary : button}>
            {PAGE_NAMES[k]}{unsaved(k) ? " ●" : ""}{flags[k] === false ? "" : ""}
          </button>
        ))}
      </div>
      {!draft && !error && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
      {draft && page && (
        <>
          <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 10 }}>
            Address on the website: <b style={{ color: C.ink }}>/{page.slug}</b> · {page.hasContent ? "Has text: the footer link opens this page" : "No text yet: the footer link still opens the old website"}{page.updatedAt ? ` · last updated ${when(page.updatedAt)}` : ""}
          </div>
          {["en", "ar"].map((l) => (
            <label key={l} htmlFor={`page-title-${l}`} style={{ ...body, display: "block", fontSize: 12, color: C.muted, marginBottom: 6 }}>Title ({l === "en" ? "English" : "Arabic"})
              <input id={`page-title-${l}`} type="text" dir={l === "ar" ? "rtl" : "ltr"} maxLength={MAX.title} value={draft.title[l]} placeholder={l === "en" ? PAGE_NAMES[active] : "Leave empty to use the website's own Arabic name"} onChange={(e) => edit("title", l, e.target.value)} style={{ ...field, marginTop: 3 }} />
            </label>
          ))}
          <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "10px 0 6px", flexWrap: "wrap" }}>
            {["en", "ar"].map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} style={lang === l ? primary : button}>{l === "en" ? "English" : "العربية"}</button>)}
            <span style={{ flex: 1 }} />
            <button type="button" style={button} aria-label="Bold" onClick={() => format(bold)}><b>B</b></button>
            <button type="button" style={button} aria-label="Heading" onClick={() => format(heading)}>H</button>
            <button type="button" style={button} aria-label="Bullet list" onClick={() => format(bulletList)}>• List</button>
            <button type="button" style={button} aria-label="Link" onClick={() => format(link)}>Link</button>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <textarea ref={area} aria-label={`Text of ${PAGE_NAMES[active]} (${lang === "en" ? "English" : "Arabic"})`} rows={16} dir={lang === "ar" ? "rtl" : "ltr"} maxLength={MAX.body} value={draft.body[lang]} onChange={(e) => edit("body", lang, e.target.value)} style={{ ...field, fontFamily: "inherit", resize: "vertical", lineHeight: 1.5 }} />
              <div style={{ ...body, fontSize: 11.5, color: C.muted, marginTop: 4 }}>{draft.body[lang].length.toLocaleString("en-US")} / {MAX.body.toLocaleString("en-US")} characters. <code>## Heading</code> · <code>- item</code> · <code>**bold**</code> · <code>[words](https://address)</code> · a blank line starts a new paragraph.</div>
            </div>
            <div style={{ flex: 1, minWidth: 260, borderWidth: 1, borderStyle: "dashed", borderColor: C.line, borderRadius: 8, padding: "6px 12px", background: C.canvas }}>
              <div style={{ ...body, fontSize: 11, color: C.muted }}>Preview (as on the website)</div>
              <MiniPreview source={draft.body[lang]} dir={lang === "ar" ? "rtl" : "ltr"} />
            </div>
          </div>
          {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, marginTop: 10 }}>{error}</div>}
          {message && <div role="status" style={{ ...body, fontSize: 12.5, color: "#16794F", marginTop: 10 }}>{message}</div>}
          <div style={{ textAlign: "end", marginTop: 10 }}><button type="button" style={primary} disabled={!unsaved(active) || saving} onClick={save}>{saving ? "Saving…" : "Save this page"}</button></div>
        </>
      )}
      {!page && error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red }}>{error}</div>}
    </div>
  );
}
