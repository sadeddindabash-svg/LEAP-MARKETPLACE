import React, { useState, useEffect } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken } from "./auth";
import { fetchFooter, saveSocial, uploadSocialIcon, removeSocialIcon } from "./footerApi";
import { pictureSrc } from "./homePicturesApi";
import { loadImageFile, renderIcon, ICON_PX, ICON_MIN_PX } from "./socialIconImage";
import CropDialog from "./CropDialog";

// "Footer social media": the icons under the website footer's tagline. Each has a name (what a screen reader says), a link, and a square picture. The website shows an icon only when it has a link; an icon with no picture of its
// own shows the Leap logo. A picture can be added once the icon is saved (it belongs to the saved icon).
const MAX_ITEMS = 8;
const field = { ...body, width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: C.line, color: C.ink, background: "#fff" };
const button = { ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: C.line, background: "#fff", color: C.ink };
const primary = { ...button, background: C.ink, color: "#fff", borderColor: C.ink };
let counter = 0;
const fromServer = (list) => list.map((s) => ({ key: s.id, id: s.id, name: s.name, url: s.url || "", icon: s.icon || null }));
const shape = (items) => JSON.stringify(items.map((i) => [i.id || null, i.name.trim(), i.url.trim()]));

export default function SocialLinksSection({ onSessionExpired }) {
  const [items, setItems] = useState(null); const [saved, setSaved] = useState("[]"); const [loadState, setLoadState] = useState("loading");
  const [error, setError] = useState(null); const [message, setMessage] = useState(null); const [saving, setSaving] = useState(false);
  const [crop, setCrop] = useState(null); const [cropError, setCropError] = useState(null); const [cropSaving, setCropSaving] = useState(false); const [confirming, setConfirming] = useState(null);

  useEffect(() => { fetchFooter().then((d) => { const list = fromServer(d.social); setItems(list); setSaved(shape(list)); setLoadState("ready"); }).catch((e) => { setError(e.message); setLoadState("error"); }); }, []);
  useEffect(() => () => { if (crop) URL.revokeObjectURL(crop.image.url); }, [crop]);
  const expired = (err) => { if (err instanceof SessionExpiredError) { onSessionExpired?.(); return true; } return false; };
  const edit = (fn) => { setMessage(null); setItems((list) => fn([...list])); };
  const dirty = items && shape(items) !== saved; const missingName = items && items.some((i) => !i.name.trim());

  const save = async () => {
    setSaving(true); setError(null); setMessage(null);
    try { const data = await saveSocial(getStoredToken(), items.map((i) => ({ id: i.id, name: i.name.trim(), url: i.url.trim() }))); const list = fromServer(data.social); setItems(list); setSaved(shape(list)); setMessage("Saved. The website shows the change within about a minute."); }
    catch (err) { if (!expired(err)) setError(err.message); } finally { setSaving(false); }
  };
  const choose = async (item, event) => {
    const file = event.target.files && event.target.files[0]; event.target.value = ""; if (!file) return; setError(null); setMessage(null);
    try {
      const image = await loadImageFile(file);
      if (image.width < ICON_MIN_PX || image.height < ICON_MIN_PX) { URL.revokeObjectURL(image.url); setError(`This picture is too small (${image.width} × ${image.height} px). Please choose one that is at least ${ICON_MIN_PX} × ${ICON_MIN_PX} px.`); return; }
      setCropError(null); setCrop({ id: item.id, name: item.name, image });
    } catch (err) { setError(err.message); }
  };
  const useCrop = async (rect) => {
    setCropSaving(true); setCropError(null);
    try {
      const blob = await renderIcon(crop.image.image, rect); const data = await uploadSocialIcon(getStoredToken(), crop.id, blob);
      setItems((list) => list.map((i) => (i.id === crop.id ? { ...i, icon: data.icon } : i))); setCrop(null); setMessage(`Saved. The website shows the new ${crop.name} picture within about a minute.`);
    } catch (err) { if (!expired(err)) setCropError(err.message); } finally { setCropSaving(false); }
  };
  const removeIcon = async (item) => {
    setError(null); setMessage(null);
    try { await removeSocialIcon(getStoredToken(), item.id); setItems((list) => list.map((i) => (i.id === item.id ? { ...i, icon: null } : i))); setConfirming(null); setMessage(`The ${item.name} picture was removed: the website shows the Leap logo for it.`); }
    catch (err) { if (!expired(err)) setError(err.message); }
  };

  return (
    <div style={{ flex: 1, minWidth: 420, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
      <h2 style={{ ...body, fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>Footer social media</h2>
      <p style={{ ...body, fontSize: 12.5, color: C.muted, margin: "6px 0 14px", lineHeight: 1.5 }}>The icons under the footer's tagline: up to {MAX_ITEMS}. An icon shows on the website only when it has a link, and shows the Leap logo until you choose its picture (square, at least {ICON_MIN_PX} × {ICON_MIN_PX} px; saved at {ICON_PX} × {ICON_PX}).</p>
      {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
      {loadState === "error" && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red }}>{error}</div>}
      {loadState === "ready" && (
        <>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((item, index) => (
              <li key={item.key} data-testid={`social-${index}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.line}`, flexWrap: "wrap" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.canvas, border: `1px solid ${C.line}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...body, fontSize: 9, color: C.muted, textAlign: "center" }}>
                  {item.icon ? <img src={pictureSrc(item.icon)} alt={`${item.name} picture`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span title="The website shows the Leap logo">Leap logo</span>}
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <input aria-label={`Name of icon ${index + 1}`} type="text" maxLength={40} placeholder="Name, e.g. Facebook" value={item.name} onChange={(e) => edit((l) => { l[index] = { ...item, name: e.target.value }; return l; })} style={field} />
                  <input aria-label={`Link of ${item.name || `icon ${index + 1}`}`} type="text" maxLength={300} placeholder="https://facebook.com/your-page" value={item.url} onChange={(e) => edit((l) => { l[index] = { ...item, url: e.target.value }; return l; })} style={{ ...field, marginTop: 6 }} />
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {item.id ? (
                    confirming === item.id ? (
                      <><span style={{ ...body, fontSize: 12.5 }}>Remove the picture?</span><button type="button" style={primary} onClick={() => removeIcon(item)}>Remove</button><button type="button" style={button} onClick={() => setConfirming(null)}>Keep</button></>
                    ) : (
                      <>
                        <label style={button}>{item.icon ? "Replace picture" : "Choose picture"}<input type="file" accept="image/jpeg,image/png,image/webp" data-testid={`file-${index}`} aria-label={`${item.icon ? "Replace" : "Choose"} the picture of ${item.name}`} style={{ display: "none" }} onChange={(e) => choose(item, e)} /></label>
                        {item.icon && <button type="button" style={button} onClick={() => setConfirming(item.id)} aria-label={`Remove the picture of ${item.name}`}>Remove picture</button>}
                      </>
                    )
                  ) : <span style={{ ...body, fontSize: 11.5, color: C.muted }}>Save first, then add a picture</span>}
                  <button type="button" style={{ ...button, padding: 6 }} aria-label={`Move ${item.name || `icon ${index + 1}`} up`} disabled={index === 0} onClick={() => edit((l) => { [l[index - 1], l[index]] = [l[index], l[index - 1]]; return l; })}><ArrowUp size={14} /></button>
                  <button type="button" style={{ ...button, padding: 6 }} aria-label={`Move ${item.name || `icon ${index + 1}`} down`} disabled={index === items.length - 1} onClick={() => edit((l) => { [l[index + 1], l[index]] = [l[index], l[index + 1]]; return l; })}><ArrowDown size={14} /></button>
                  <button type="button" style={button} aria-label={`Remove ${item.name || `icon ${index + 1}`}`} onClick={() => edit((l) => { l.splice(index, 1); return l; })}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 10 }}><button type="button" style={button} disabled={items.length >= MAX_ITEMS} onClick={() => edit((l) => [...l, { key: `new${++counter}`, id: undefined, name: "", url: "", icon: null }])}>+ Add social media</button>{items.length >= MAX_ITEMS && <span style={{ ...body, fontSize: 12, color: C.muted, marginInlineStart: 8 }}>That is the most there can be.</span>}</div>
          {missingName && <div style={{ ...body, fontSize: 12.5, color: C.muted, marginTop: 8 }}>Every icon needs a name (it is what a screen reader says).</div>}
          {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, marginTop: 8 }}>{error}</div>}
          {message && <div role="status" style={{ ...body, fontSize: 12.5, color: "#16794F", marginTop: 8 }}>{message}</div>}
          <div style={{ textAlign: "end", marginTop: 10 }}><button type="button" style={primary} disabled={!dirty || saving || missingName} onClick={save}>{saving ? "Saving…" : "Save"}</button></div>
        </>
      )}
      {crop && <CropDialog title={`Crop the picture for ${crop.name}`} image={crop.image} resultText={`The icon will be ${ICON_PX} × ${ICON_PX} px.`} saving={cropSaving} error={cropError} onCancel={() => { setCrop(null); setCropError(null); }} onUse={useCrop} />}
    </div>
  );
}
