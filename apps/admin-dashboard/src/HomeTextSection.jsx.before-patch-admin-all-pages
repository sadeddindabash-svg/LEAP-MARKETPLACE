import React, { useState, useEffect } from "react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken } from "./auth";
import { fetchHomeText, saveHomeText } from "./homeTextApi";

// "Home page text": the message in the top bar, and the headline and sub-headline of the website's home page, each in English and Arabic; the headline and the sub-headline also have a font and a size.
// An empty text means the website uses its own wording. Nothing changes on the website until Save is pressed, and then within about a minute.
const FONT_LABELS = { default: "Website default (Outfit / IBM Plex Sans Arabic)", inter: "Inter", poppins: "Poppins", montserrat: "Montserrat", cairo: "Cairo (Arabic and English)", tajawal: "Tajawal (Arabic and English)" };
const SIZE_LABELS = { small: "Small", medium: "Medium", large: "Large", xlarge: "Extra large" };
const PREVIEW_PX = { headline: { small: 24, medium: 30, large: 36, xlarge: 44 }, subheadline: { small: 14, medium: 16, large: 18, xlarge: 22 } };
const DEFAULT_SIZE = { headline: "large", subheadline: "medium" };
const MAX = { topBar: 160, headline: 120, subheadline: 240 };
const BUILT_IN = { topBar: "Largest ready-to-ship warehouse for Chinese auto parts", headline: "Find the right part for your car", subheadline: "Real parts from verified suppliers, matched to your vehicle." };
const TITLES = { topBar: "Top bar message", headline: "Headline", subheadline: "Sub-headline" };
const EMPTY = { topBar: { en: "", ar: "" }, headline: { en: "", ar: "", font: "default", size: "large" }, subheadline: { en: "", ar: "", font: "default", size: "medium" } };
const blank = (name) => EMPTY[name];

const field = { ...body, width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: C.line, color: C.ink, background: "#fff" };
const button = { ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: C.line, background: "#fff", color: C.ink };
const primary = { ...button, background: C.ink, color: "#fff", borderColor: C.ink };
/** What the server sends (null for "no text") as what the fields show (""). */
const toDraft = (text) => {
  const d = {};
  for (const name of ["topBar", "headline", "subheadline"]) d[name] = { ...blank(name), ...(text?.[name] || {}), en: text?.[name]?.en || "", ar: text?.[name]?.ar || "" };
  return d;
};
const clean = (draft) => {
  const out = {};
  for (const name of ["topBar", "headline", "subheadline"]) { out[name] = { en: draft[name].en.trim(), ar: draft[name].ar.trim() }; if (name !== "topBar") { out[name].font = draft[name].font; out[name].size = draft[name].size; } }
  return out;
};

export default function HomeTextSection({ onSessionExpired }) {
  const [saved, setSaved] = useState(null);       // what the website has now (as the fields show it)
  const [draft, setDraft] = useState(null);
  const [lists, setLists] = useState({ fonts: Object.keys(FONT_LABELS), sizes: Object.keys(SIZE_LABELS) });
  const [loadState, setLoadState] = useState("loading");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchHomeText().then((data) => { const d = toDraft(data.text); setSaved(d); setDraft(d); if (data.fonts && data.sizes) setLists({ fonts: data.fonts, sizes: data.sizes }); setLoadState("ready"); }).catch((e) => { setError(e.message); setLoadState("error"); }); }, []);

  const set = (name, key, value) => { setMessage(null); setDraft((d) => ({ ...d, [name]: { ...d[name], [key]: value } })); };
  const reset = (name) => { setMessage(null); setDraft((d) => ({ ...d, [name]: { ...blank(name) } })); };
  const dirty = draft && JSON.stringify(clean(draft)) !== JSON.stringify(clean(saved));
  const save = async () => {
    setSaving(true); setError(null); setMessage(null);
    try {
      const data = await saveHomeText(getStoredToken(), clean(draft));
      const d = toDraft(data.text); setSaved(d); setDraft(d); setMessage("Saved. The website shows the change within about a minute.");
    } catch (err) { if (err instanceof SessionExpiredError) onSessionExpired?.(); else setError(err.message); }
    finally { setSaving(false); }
  };

  const textField = (name, lang, label, rows = 1) => {
    const id = `home-text-${name}-${lang}`; const Tag = rows > 1 ? "textarea" : "input";
    return (
      <label htmlFor={id} style={{ ...body, display: "block", fontSize: 12, color: C.muted, marginTop: 8 }}>
        {label}
        <Tag id={id} {...(rows > 1 ? { rows } : { type: "text" })} dir={lang === "ar" ? "rtl" : "ltr"} maxLength={MAX[name]} value={draft[name][lang]} placeholder={lang === "en" ? BUILT_IN[name] : "Leave empty to use the website's own Arabic wording"}
          onChange={(e) => set(name, lang, e.target.value)} style={{ ...field, marginTop: 4, resize: "vertical" }} />
      </label>
    );
  };
  const styleFields = (name) => (
    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
      <label style={{ ...body, flex: 1, fontSize: 12, color: C.muted }}>Font
        <select aria-label={`${TITLES[name]} font`} value={draft[name].font} onChange={(e) => set(name, "font", e.target.value)} style={{ ...field, marginTop: 4 }}>{lists.fonts.map((f) => <option key={f} value={f}>{FONT_LABELS[f] || f}</option>)}</select>
      </label>
      <label style={{ ...body, flex: 1, fontSize: 12, color: C.muted }}>Size
        <select aria-label={`${TITLES[name]} size`} value={draft[name].size} onChange={(e) => set(name, "size", e.target.value)} style={{ ...field, marginTop: 4 }}>{lists.sizes.map((s) => <option key={s} value={s}>{SIZE_LABELS[s] || s}{s === DEFAULT_SIZE[name] ? " (website default)" : ""}</option>)}</select>
      </label>
    </div>
  );
  const preview = (name) => {
    const family = draft[name].font === "default" ? undefined : FONT_LABELS[draft[name].font]?.split(" (")[0];
    return (
      <div aria-label={`${TITLES[name]} preview`} style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: C.canvas, borderWidth: 1, borderStyle: "dashed", borderColor: C.line }}>
        <div style={{ ...body, fontSize: 11, color: C.muted, marginBottom: 4 }}>Preview (the exact font shows on the website)</div>
        <div data-testid={`preview-${name}`} style={{ fontFamily: family, fontSize: PREVIEW_PX[name][draft[name].size], fontWeight: name === "headline" ? 700 : 400, color: C.ink, lineHeight: 1.2 }}>{draft[name].en.trim() || BUILT_IN[name]}</div>
      </div>
    );
  };
  const block = (name) => (
    <fieldset key={name} style={{ borderWidth: 1, borderStyle: "solid", borderColor: C.line, borderRadius: 10, padding: "10px 14px 14px", margin: "0 0 12px" }}>
      <legend style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, padding: "0 6px" }}>{TITLES[name]}</legend>
      {textField(name, "en", "English", name === "subheadline" ? 2 : 1)}
      {textField(name, "ar", "Arabic", name === "subheadline" ? 2 : 1)}
      {name !== "topBar" && styleFields(name)}
      {name !== "topBar" && preview(name)}
      <div style={{ marginTop: 10, textAlign: "end" }}><button type="button" style={button} onClick={() => reset(name)} aria-label={`Reset ${TITLES[name]} to default`}>Reset to default</button></div>
    </fieldset>
  );

  return (
    <div style={{ flex: 1, minWidth: 420, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
      <h2 style={{ ...body, fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>Home page text</h2>
      <p style={{ ...body, fontSize: 12.5, color: C.muted, margin: "6px 0 14px", lineHeight: 1.5 }}>The message at the very top of the website, and the headline and sub-headline of the home page. An empty text means the website uses its own wording.</p>
      {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
      {loadState === "error" && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red }}>{error}</div>}
      {loadState === "ready" && (
        <>
          {["topBar", "headline", "subheadline"].map(block)}
          {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, marginBottom: 8 }}>{error}</div>}
          {message && <div role="status" style={{ ...body, fontSize: 12.5, color: "#16794F", marginBottom: 8 }}>{message}</div>}
          <div style={{ textAlign: "end" }}><button type="button" style={primary} disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save"}</button></div>
        </>
      )}
    </div>
  );
}
