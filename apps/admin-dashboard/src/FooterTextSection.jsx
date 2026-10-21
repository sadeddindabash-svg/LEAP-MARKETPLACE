import React, { useState, useEffect } from "react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken } from "./auth";
import { fetchFooter, saveFooterText, PAGE_KEYS, PAGE_NAMES } from "./footerApi";

// "Footer text": the tagline, the copyright line, the four column titles, and the wording and visibility of the six "Useful links". An empty text means the website uses its own wording. Nothing changes on the website
// until Save is pressed, and then within about a minute.
const TITLES = { shop: "Shop", account: "My account", help: "Help", useful: "Useful links" };
const BUILT_IN = { tagline: "Real parts, direct from verified suppliers.", copyright: "Copyright © Leap Auto Parts {year}" };
const MAX = { tagline: 160, copyright: 160, title: 40, link: 40 };
const AR_HINT = "Leave empty to use the website's own Arabic wording";
const field = { ...body, width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: C.line, color: C.ink, background: "#fff" };
const button = { ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: C.line, background: "#fff", color: C.ink };
const primary = { ...button, background: C.ink, color: "#fff", borderColor: C.ink };
const pair = (p) => ({ en: p?.en || "", ar: p?.ar || "" });
const toDraft = (t) => ({ tagline: pair(t?.tagline), copyright: pair(t?.copyright), titles: Object.fromEntries(Object.keys(TITLES).map((k) => [k, pair(t?.titles?.[k])])), links: Object.fromEntries(PAGE_KEYS.map((k) => [k, { ...pair(t?.links?.[k]), shown: t?.links?.[k]?.shown !== false }])) });
const clean = (d) => ({ tagline: { en: d.tagline.en.trim(), ar: d.tagline.ar.trim() }, copyright: { en: d.copyright.en.trim(), ar: d.copyright.ar.trim() }, titles: Object.fromEntries(Object.keys(TITLES).map((k) => [k, { en: d.titles[k].en.trim(), ar: d.titles[k].ar.trim() }])), links: Object.fromEntries(PAGE_KEYS.map((k) => [k, { en: d.links[k].en.trim(), ar: d.links[k].ar.trim(), shown: d.links[k].shown }])) });

export default function FooterTextSection({ onSessionExpired }) {
  const [saved, setSaved] = useState(null); const [draft, setDraft] = useState(null); const [loadState, setLoadState] = useState("loading");
  const [error, setError] = useState(null); const [message, setMessage] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => { fetchFooter().then((d) => { const x = toDraft(d.text); setSaved(x); setDraft(x); setLoadState("ready"); }).catch((e) => { setError(e.message); setLoadState("error"); }); }, []);
  const edit = (fn) => { setMessage(null); setDraft((d) => { const next = JSON.parse(JSON.stringify(d)); fn(next); return next; }); };
  const dirty = draft && JSON.stringify(clean(draft)) !== JSON.stringify(clean(saved));
  const save = async () => {
    setSaving(true); setError(null); setMessage(null);
    try { const data = await saveFooterText(getStoredToken(), clean(draft)); const x = toDraft(data.text); setSaved(x); setDraft(x); setMessage("Saved. The website shows the change within about a minute."); }
    catch (err) { if (err instanceof SessionExpiredError) onSessionExpired?.(); else setError(err.message); } finally { setSaving(false); }
  };
  const input = (id, label, value, max, onChange, ar, placeholder) => (
    <label htmlFor={id} style={{ ...body, display: "block", fontSize: 12, color: C.muted, marginTop: 6 }}>{label}
      <input id={id} type="text" dir={ar ? "rtl" : "ltr"} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ ...field, marginTop: 3 }} />
    </label>
  );
  const group = (title, children) => <fieldset style={{ borderWidth: 1, borderStyle: "solid", borderColor: C.line, borderRadius: 10, padding: "8px 14px 14px", margin: "0 0 12px" }}><legend style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, padding: "0 6px" }}>{title}</legend>{children}</fieldset>;
  return (
    <div style={{ flex: 1, minWidth: 420, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
      <h2 style={{ ...body, fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>Footer text</h2>
      <p style={{ ...body, fontSize: 12.5, color: C.muted, margin: "6px 0 14px", lineHeight: 1.5 }}>The words at the bottom of every page of the website. An empty text means the website uses its own wording.</p>
      {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
      {loadState === "error" && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red }}>{error}</div>}
      {loadState === "ready" && (
        <>
          {group("Tagline", <>{input("ft-tagline-en", "English", draft.tagline.en, MAX.tagline, (v) => edit((d) => { d.tagline.en = v; }), false, BUILT_IN.tagline)}{input("ft-tagline-ar", "Arabic", draft.tagline.ar, MAX.tagline, (v) => edit((d) => { d.tagline.ar = v; }), true, AR_HINT)}</>)}
          {group("Copyright line", <><div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 4 }}>Write <b>{"{year}"}</b> where the year goes: it fills in by itself every year.</div>{input("ft-copyright-en", "English", draft.copyright.en, MAX.copyright, (v) => edit((d) => { d.copyright.en = v; }), false, BUILT_IN.copyright)}{input("ft-copyright-ar", "Arabic", draft.copyright.ar, MAX.copyright, (v) => edit((d) => { d.copyright.ar = v; }), true, AR_HINT)}</>)}
          {group("Column titles", Object.keys(TITLES).map((k) => <div key={k} style={{ display: "flex", gap: 10 }}><div style={{ flex: 1 }}>{input(`ft-title-${k}-en`, `${TITLES[k]} (English)`, draft.titles[k].en, MAX.title, (v) => edit((d) => { d.titles[k].en = v; }), false, TITLES[k])}</div><div style={{ flex: 1 }}>{input(`ft-title-${k}-ar`, `${TITLES[k]} (Arabic)`, draft.titles[k].ar, MAX.title, (v) => edit((d) => { d.titles[k].ar = v; }), true, AR_HINT)}</div></div>))}
          {group("Useful links: wording, and whether each is shown", PAGE_KEYS.map((k) => (
            <div key={k} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>{input(`ft-link-${k}-en`, `${PAGE_NAMES[k]} (English)`, draft.links[k].en, MAX.link, (v) => edit((d) => { d.links[k].en = v; }), false, PAGE_NAMES[k])}</div>
              <div style={{ flex: 1 }}>{input(`ft-link-${k}-ar`, `${PAGE_NAMES[k]} (Arabic)`, draft.links[k].ar, MAX.link, (v) => edit((d) => { d.links[k].ar = v; }), true, AR_HINT)}</div>
              <label style={{ ...body, fontSize: 12.5, color: C.ink, paddingBottom: 9, whiteSpace: "nowrap" }}><input type="checkbox" aria-label={`Show ${PAGE_NAMES[k]}`} checked={draft.links[k].shown} onChange={(e) => edit((d) => { d.links[k].shown = e.target.checked; })} /> Shown</label>
            </div>
          )))}
          {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, marginBottom: 8 }}>{error}</div>}
          {message && <div role="status" style={{ ...body, fontSize: 12.5, color: "#16794F", marginBottom: 8 }}>{message}</div>}
          <div style={{ textAlign: "end" }}><button type="button" style={primary} disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save"}</button></div>
        </>
      )}
    </div>
  );
}
