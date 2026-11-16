import React, { useState, useEffect } from "react";
import { Image as ImageIcon, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken, fetchCategories, fetchAdminProducts } from "./auth";
import { fetchBannerAdmin, setBannerMode, addBannerSlide, saveBannerSlide, removeBannerSlide, reorderBannerSlides, uploadBannerPhoto, removeBannerPhoto } from "./homeBannerApi";
import { pictureSrc } from "./homePicturesApi";
import { loadImageFile } from "./homePictureImage";
import { renderBannerCrop } from "./bannerImage";
import { OUTPUT_W, OUTPUT_H, MIN_SOURCE_W, MIN_SOURCE_H } from "./bannerCrop";
import BannerCropDialog from "./BannerCropDialog";

// "Home banner": what the home page shows beside the "Find parts for your car" box: EITHER the headline and sub-headline OR a banner of up to 10 advertisement photos (never both). Each slide has an English photo and an Arabic photo (the
// website and the app show the one for their language), its own seconds on screen, and an optional link to a part, a category or a web page. A change shows on the home page within about a minute.
const LANG_LABEL = { en: "English photo", ar: "Arabic photo" };
const LINK_TYPES = [["none", "No link"], ["part", "A part"], ["category", "A category"], ["url", "A web page"]];
const button = { ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: C.line, background: "#fff", color: C.ink };
const primary = { ...button, background: C.ink, color: "#fff", borderColor: C.ink };
const field = { ...body, fontSize: 13, padding: "6px 9px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, boxSizing: "border-box" };
const label = { ...body, fontSize: 12, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 };

const draftOf = (s) => ({ seconds: String(s.seconds), linkType: s.link.type, linkValue: s.link.value, linkLabel: s.link.value, altEn: s.altEn, altAr: s.altAr });
const sameLink = (s, d) => s.link.type === d.linkType && (d.linkType === "none" || s.link.value === d.linkValue.trim());
const isDirty = (s, d) => !!d && (String(s.seconds) !== d.seconds.trim() || !sameLink(s, d) || s.altEn !== d.altEn.trim() || s.altAr !== d.altAr.trim());

/** Where the slide leads: a part (searched by name or number), a category (chosen from the list) or a web page (typed). */
function LinkEditor({ draft, categories, onChange, onError }) {
  const [term, setTerm] = useState(""); const [found, setFound] = useState(null); const [searching, setSearching] = useState(false);
  const search = async () => {
    if (!term.trim()) return; setSearching(true);
    try { const r = await fetchAdminProducts(getStoredToken(), { search: term.trim(), page: 1 }); setFound((r.products || []).slice(0, 8)); } catch (err) { onError(err); } finally { setSearching(false); }
  };
  return (
    <div>
      <label style={label}>Where the photo leads
        <select aria-label="Link goes to" value={draft.linkType} onChange={(e) => onChange({ linkType: e.target.value, linkValue: "", linkLabel: "" })} style={{ ...field, display: "block", width: "100%", marginTop: 4 }}>
          {LINK_TYPES.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
        </select>
      </label>
      {draft.linkType === "part" && (
        <div style={{ marginTop: 8 }}>
          {draft.linkValue ? <div style={{ ...body, fontSize: 12.5, color: C.ink }}>Leads to: <b>{draft.linkLabel}</b> <span style={{ color: C.muted }}>({draft.linkValue})</span> <button type="button" style={{ ...button, padding: "2px 8px", marginInlineStart: 6 }} onClick={() => onChange({ linkValue: "", linkLabel: "" })}>Change</button></div> : (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                <input aria-label="Search for a part" placeholder="Part name or number" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} style={{ ...field, flex: 1 }} />
                <button type="button" style={button} disabled={searching || !term.trim()} onClick={search}>{searching ? "Searching…" : "Search"}</button>
              </div>
              {found && (found.length === 0 ? <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 6 }}>No live part matches that.</div> : (
                <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>{found.map((p) => <li key={p.id}><button type="button" style={{ ...button, width: "100%", textAlign: "start", marginBottom: 4 }} onClick={() => { onChange({ linkValue: p.id, linkLabel: p.name }); setFound(null); }}>{p.name} <span style={{ color: C.muted }}>· {p.id}</span></button></li>)}</ul>
              ))}
            </>
          )}
        </div>
      )}
      {draft.linkType === "category" && (
        <select aria-label="Category" value={draft.linkValue} onChange={(e) => onChange({ linkValue: e.target.value, linkLabel: e.target.value })} style={{ ...field, display: "block", width: "100%", marginTop: 8 }}>
          <option value="">Choose a category…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
        </select>
      )}
      {draft.linkType === "url" && (
        <>
          <input type="url" aria-label="Web page address" placeholder="https://example.com/sale" value={draft.linkValue} onChange={(e) => onChange({ linkValue: e.target.value, linkLabel: e.target.value })} style={{ ...field, display: "block", width: "100%", marginTop: 8 }} />
          {draft.linkValue.trim() && !/^https?:\/\/\S+$/i.test(draft.linkValue.trim()) && <div style={{ ...body, fontSize: 12, color: C.red, marginTop: 4 }}>The address must start with https:// (or http://).</div>}
        </>
      )}
    </div>
  );
}

/** What the card needs from the server's answer. Anything else (an older backend that was not restarted, a proxy page, another feature's data) is a clear message in the card, never a crash. */
const usable = (d) => !!d && typeof d === "object" && Array.isArray(d.slides) && !!d.limits && typeof d.limits === "object" && Number.isFinite(d.limits.maxSlides);
const UNEXPECTED = "The server's answer about the home banner was not what was expected. Restart the backend so that it has the banner update, then reload this page.";

function HomeBannerCard({ onSessionExpired }) {
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [drafts, setDrafts] = useState({});
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(null);                 // "mode", "add", or a slide's id
  const [removing, setRemoving] = useState(null);         // a slide's id waiting for "Yes, remove"
  const [crop, setCrop] = useState(null);                 // { slideId, lang, number, image }
  const [cropError, setCropError] = useState(null);
  const [cropSaving, setCropSaving] = useState(false);

  const expired = (err) => { if (err instanceof SessionExpiredError) { onSessionExpired?.(); return true; } return false; };
  const fail = (err) => { if (!expired(err)) setError(err.message); };
  useEffect(() => {
    fetchBannerAdmin(getStoredToken()).then((d) => { if (!usable(d)) throw new Error(UNEXPECTED); const drafts = Object.fromEntries(d.slides.map((s) => [s.id, draftOf(s)])); setData(d); setDrafts(drafts); setLoadState("ready"); }).catch((e) => { if (!expired(e)) { setError(e.message); setLoadState("error"); } });
    fetchCategories().then((c) => setCategories(Array.isArray(c) ? c : [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (crop) URL.revokeObjectURL(crop.image.url); }, [crop]);

  const run = async (key, work, message) => {
    setBusy(key); setError(null); setSaved(null);
    try { const r = await work(); if (message) setSaved(message); return r; } catch (err) { fail(err); return null; } finally { setBusy(null); }
  };
  const take = (r) => { if (!r || !Array.isArray(r.slides)) throw new Error(UNEXPECTED); setData((d) => ({ ...d, mode: r.mode, slides: r.slides, limits: r.limits || d.limits })); return r; };
  const edit = (id, patch) => setDrafts((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  const token = () => getStoredToken();

  const changeMode = async (mode) => { await run("mode", async () => take(await setBannerMode(token(), mode)), mode === "banner" ? "The home page will show the banner (within about a minute)." : "The home page will show the headline and sub-headline (within about a minute)."); };
  const add = async () => { const r = await run("add", async () => take(await addBannerSlide(token(), {})), "A new slide was added. Choose its photos below."); if (r) setDrafts((all) => ({ ...all, [r.slide.id]: draftOf(r.slide) })); };
  const save = async (slide) => {
    const d = drafts[slide.id]; const fields = {};
    const seconds = Number(d.seconds.trim());
    if (!Number.isInteger(seconds) || seconds < data.limits.minSeconds || seconds > data.limits.maxSeconds) { setError(`Seconds must be a whole number from ${data.limits.minSeconds} to ${data.limits.maxSeconds}.`); return; }
    if (seconds !== slide.seconds) fields.seconds = seconds;
    if (!sameLink(slide, d)) fields.link = d.linkType === "none" ? { type: "none" } : { type: d.linkType, value: d.linkValue.trim() };
    if (s(d.altEn) !== slide.altEn) fields.altEn = s(d.altEn); if (s(d.altAr) !== slide.altAr) fields.altAr = s(d.altAr);
    const r = await run(slide.id, async () => take(await saveBannerSlide(token(), slide.id, fields)), "Saved. The home page shows the change within about a minute.");
    if (r) edit(slide.id, draftOf(r.slide));
  };
  const remove = async (slide) => { const r = await run(slide.id, async () => take(await removeBannerSlide(token(), slide.id)), "The slide and its photos were removed."); if (r) { setRemoving(null); setDrafts((all) => { const c = { ...all }; delete c[slide.id]; return c; }); } };
  const move = async (index, by) => { const ids = data.slides.map((x) => x.id); [ids[index], ids[index + by]] = [ids[index + by], ids[index]]; await run("order", async () => take(await reorderBannerSlides(token(), ids)), "The order was changed."); };
  const removePhoto = async (slide, number, lang) => { await run(slide.id, async () => take(await removeBannerPhoto(token(), slide.id, lang)), `The ${LANG_LABEL[lang]} of slide ${number} was removed.`); };

  const choose = async (slide, number, lang, event) => {
    const file = event.target.files && event.target.files[0]; event.target.value = ""; if (!file) return;
    setError(null); setSaved(null);
    try {
      const loaded = await loadImageFile(file);
      if (loaded.width < MIN_SOURCE_W || loaded.height < MIN_SOURCE_H) { URL.revokeObjectURL(loaded.url); setError(`This picture is too small (${loaded.width} × ${loaded.height} px). Please choose one that is at least ${MIN_SOURCE_W} × ${MIN_SOURCE_H} px, so the banner stays sharp.`); return; }
      setCropError(null); setCrop({ slideId: slide.id, lang, number, image: loaded });
    } catch (err) { setError(err.message); }
  };
  const closeCrop = () => { setCrop(null); setCropError(null); };
  const useCrop = async (rect) => {
    setCropSaving(true); setCropError(null);
    try {
      const blob = await renderBannerCrop(crop.image.image, rect);
      const r = await uploadBannerPhoto(token(), crop.slideId, crop.lang, blob); take(r); setSaved(`Saved. The ${LANG_LABEL[crop.lang]} of slide ${crop.number} is on the home page within about a minute.`); closeCrop();
    } catch (err) { if (!expired(err)) setCropError(err.message); } finally { setCropSaving(false); }
  };

  const slides = data ? data.slides : [];
  const anyPhoto = slides.some((x) => x.imageEn || x.imageAr);
  return (
    <div style={{ flex: 1, minWidth: 420, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
      <h2 style={{ ...body, fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>Home banner</h2>
      <p style={{ ...body, fontSize: 12.5, color: C.muted, margin: "6px 0 14px", lineHeight: 1.5 }}>
        Beside the “Find parts for your car” box the home page shows <b>either</b> the headline and sub-headline <b>or</b> this banner, never both. The banner takes up to 10 photos; each has an English and an Arabic photo (the site and the app show the one for their language),
        its own seconds on screen, and can lead to a part, a category or a web page. Photos are cropped to {OUTPUT_W} × {OUTPUT_H} px (choose pictures of at least {MIN_SOURCE_W} × {MIN_SOURCE_H} px: JPG, PNG or WebP).
      </p>
      {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
      {loadState === "error" && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red }}>{error}</div>}
      {loadState === "ready" && (
        <>
          {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 10 }}>{error}</div>}
          {saved && <div role="status" style={{ ...body, fontSize: 12.5, color: "#16794F", marginBottom: 10 }}>{saved}</div>}
          <fieldset style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 12px", margin: "0 0 14px" }} disabled={busy === "mode"}>
            <legend style={{ ...body, fontSize: 12.5, fontWeight: 700, color: C.ink, padding: "0 6px" }}>The home page shows</legend>
            <label style={{ ...body, fontSize: 13, color: C.ink, display: "block", padding: "3px 0" }}><input type="radio" name="home-hero-mode" checked={data.mode === "headline"} onChange={() => changeMode("headline")} /> The headline and sub-headline</label>
            <label style={{ ...body, fontSize: 13, color: C.ink, display: "block", padding: "3px 0" }}><input type="radio" name="home-hero-mode" checked={data.mode === "banner"} onChange={() => changeMode("banner")} /> The banner</label>
            {data.mode === "banner" && !anyPhoto && <div role="note" style={{ ...body, fontSize: 12, color: "#8a4b00", background: "#fff4e0", borderRadius: 6, padding: "6px 8px", marginTop: 6 }}>No slide has a photo yet, so the home page still shows the headline. Add a photo to a slide below.</div>}
          </fieldset>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {slides.map((slide, i) => {
              const d = drafts[slide.id] || draftOf(slide); const number = i + 1; const dirty = isDirty(slide, d); const working = busy === slide.id;
              return (
                <li key={slide.id} data-testid={`slide-${number}`} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <b style={{ ...body, fontSize: 13.5, color: C.ink, flex: 1 }}>Slide {number}</b>
                    <button type="button" aria-label={`Move slide ${number} up`} style={{ ...button, padding: 4 }} disabled={i === 0 || busy === "order"} onClick={() => move(i, -1)}><ChevronUp size={14} /></button>
                    <button type="button" aria-label={`Move slide ${number} down`} style={{ ...button, padding: 4 }} disabled={i === slides.length - 1 || busy === "order"} onClick={() => move(i, 1)}><ChevronDown size={14} /></button>
                    {removing === slide.id ? (
                      <><span style={{ ...body, fontSize: 12.5 }}>Remove slide {number} and its photos?</span><button type="button" style={{ ...primary, background: C.red, borderColor: C.red }} disabled={working} onClick={() => remove(slide)}>Yes, remove</button><button type="button" style={button} onClick={() => setRemoving(null)}>Keep</button></>
                    ) : <button type="button" style={button} onClick={() => setRemoving(slide.id)}>Remove slide</button>}
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {["en", "ar"].map((lang) => {
                      const url = lang === "en" ? slide.imageEn : slide.imageAr; const src = pictureSrc(url);
                      return (
                        <div key={lang} style={{ flex: 1, minWidth: 200 }}>
                          <span style={label}>{LANG_LABEL[lang]}</span>
                          <div style={{ aspectRatio: "5 / 2", borderRadius: 8, background: C.canvas, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                            {src ? <img src={src} alt={`${LANG_LABEL[lang]} of slide ${number}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={22} color={C.muted} aria-hidden="true" />}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <label style={url ? button : primary}>{url ? "Replace" : "Choose photo"}
                              <input type="file" accept="image/jpeg,image/png,image/webp" data-testid={`file-${number}-${lang}`} aria-label={`${url ? "Replace" : "Choose"} the ${LANG_LABEL[lang]} of slide ${number}`} style={{ display: "none" }} onChange={(e) => choose(slide, number, lang, e)} />
                            </label>
                            {url && <button type="button" style={button} disabled={working} onClick={() => removePhoto(slide, number, lang)} aria-label={`Remove the ${LANG_LABEL[lang]} of slide ${number}`}>Remove</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                    <div style={{ width: 120 }}>
                      <label style={label}>Seconds on screen
                        <input type="number" aria-label={`Seconds for slide ${number}`} min={data.limits.minSeconds} max={data.limits.maxSeconds} step="1" value={d.seconds} onChange={(e) => edit(slide.id, { seconds: e.target.value })} style={{ ...field, display: "block", width: "100%", marginTop: 4 }} />
                      </label>
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}><LinkEditor draft={d} categories={categories} onChange={(patch) => edit(slide.id, patch)} onError={fail} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                    <label style={{ ...label, flex: 1, minWidth: 200 }}>Describe the English photo (read aloud to people who cannot see it)
                      <input aria-label={`English description for slide ${number}`} maxLength={data.limits.maxAlt} value={d.altEn} onChange={(e) => edit(slide.id, { altEn: e.target.value })} style={{ ...field, display: "block", width: "100%", marginTop: 4 }} />
                    </label>
                    <label style={{ ...label, flex: 1, minWidth: 200 }}>Describe the Arabic photo
                      <input dir="rtl" aria-label={`Arabic description for slide ${number}`} maxLength={data.limits.maxAlt} value={d.altAr} onChange={(e) => edit(slide.id, { altAr: e.target.value })} style={{ ...field, display: "block", width: "100%", marginTop: 4 }} />
                    </label>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                    <button type="button" style={primary} disabled={!dirty || working} onClick={() => save(slide)} aria-label={`Save slide ${number}`}>{working ? "Saving…" : "Save changes"}</button>
                    {dirty && <span style={{ ...body, fontSize: 12, color: "#8a4b00" }}>Not saved yet</span>}
                  </div>
                </li>
              );
            })}
          </ol>
          <button type="button" style={{ ...primary, display: "inline-flex", alignItems: "center", gap: 6 }} disabled={slides.length >= data.limits.maxSlides || busy === "add"} onClick={add}><Plus size={14} /> Add a slide ({slides.length} of {data.limits.maxSlides})</button>
          {slides.length >= data.limits.maxSlides && <span style={{ ...body, fontSize: 12, color: C.muted, marginInlineStart: 10 }}>The banner holds at most {data.limits.maxSlides} photos.</span>}
        </>
      )}
      {crop && <BannerCropDialog title={`${LANG_LABEL[crop.lang]} for slide ${crop.number}`} image={crop.image} saving={cropSaving} error={cropError} onCancel={closeCrop} onUse={useCrop} />}
    </div>
  );
}
function s(v) { return v.trim(); }

/** A safety net: if the card ever fails while it is drawn, only the card says so; the rest of the Settings page stays. */
export class BannerCardBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error("The home banner card failed:", error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ flex: 1, minWidth: 420, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
        <h2 style={{ ...body, fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>Home banner</h2>
        <div style={{ ...body, fontSize: 12.5, color: C.red, marginTop: 8 }}>This card could not be shown. The rest of Settings is not affected. Reload the page; if it happens again, tell the Leap team.</div>
      </div>
    );
  }
}

export default function HomeBannerSection(props) {
  return <BannerCardBoundary><HomeBannerCard {...props} /></BannerCardBoundary>;
}
