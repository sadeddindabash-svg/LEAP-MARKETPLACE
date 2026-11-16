import React, { useState, useEffect, useRef } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken } from "./auth";
import { SLOTS, fetchHomePictures, uploadHomePicture, removeHomePicture, pictureSrc } from "./homePicturesApi";
import { loadImageFile, renderCrop } from "./homePictureImage";
import { OUTPUT_PX, MIN_SOURCE_PX, FRAME_PX, MIN_ZOOM, MAX_ZOOM, scaleFor, clampOffset, centeredOffset, zoomKeepingCentre, sourceRect } from "./homePictureCrop";

// "Home page pictures": the pictures beside Parts, Brands, Models and Countries on the website's home page. Choose a picture, crop it to a square (drag it, zoom it), and it is saved at 600 x 600.
// A slot with no picture keeps its icon on the website; "Remove" brings the icon back. The website shows a change within about a minute.
const LABELS = { parts: "Parts", brands: "Brands", models: "Models", countries: "Countries" };
const KEY_STEP_PX = 10;
const button = { ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: C.line, background: "#fff", color: C.ink };
const primary = { ...button, background: C.ink, color: "#fff", borderColor: C.ink };

export default function HomePicturesSection({ onSessionExpired }) {
  const [pictures, setPictures] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [crop, setCrop] = useState(null);            // { slot, image, url, width, height, zoom, offset }
  const [cropError, setCropError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [busySlot, setBusySlot] = useState(null);
  const drag = useRef(null);

  useEffect(() => { fetchHomePictures().then((p) => { setPictures(p); setLoadState("ready"); }).catch((e) => { setError(e.message); setLoadState("error"); }); }, []);
  useEffect(() => () => { if (crop) URL.revokeObjectURL(crop.url); }, [crop]);

  const expired = (err) => { if (err instanceof SessionExpiredError) { onSessionExpired?.(); return true; } return false; };
  const choose = async (slot, event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";                      // so choosing the same file again works
    if (!file) return;
    setError(null); setSaved(null);
    try {
      const loaded = await loadImageFile(file);
      if (loaded.width < MIN_SOURCE_PX || loaded.height < MIN_SOURCE_PX) { URL.revokeObjectURL(loaded.url); setError(`This picture is too small (${loaded.width} × ${loaded.height} px). Please choose one that is at least ${MIN_SOURCE_PX} × ${MIN_SOURCE_PX} px.`); return; }
      setCropError(null);
      setCrop({ slot, ...loaded, zoom: MIN_ZOOM, offset: centeredOffset(loaded.width, loaded.height, MIN_ZOOM) });
    } catch (err) { setError(err.message); }
  };
  const close = () => { setCrop(null); setCropError(null); drag.current = null; };
  const move = (dx, dy) => setCrop((c) => ({ ...c, offset: clampOffset({ x: c.offset.x + dx, y: c.offset.y + dy }, c.width, c.height, c.zoom) }));
  const setZoom = (zoom) => setCrop((c) => ({ ...c, zoom, offset: zoomKeepingCentre(c.offset, c.width, c.height, c.zoom, zoom) }));
  const save = async () => {
    setSaving(true); setCropError(null);
    try {
      const blob = await renderCrop(crop.image, sourceRect(crop.offset, crop.width, crop.height, crop.zoom));
      const data = await uploadHomePicture(getStoredToken(), crop.slot, blob);
      setPictures(data.pictures); setSaved(`Saved. The home page shows the new ${LABELS[crop.slot]} picture within about a minute.`); close();
    } catch (err) { if (!expired(err)) setCropError(err.message); } finally { setSaving(false); }
  };
  const remove = async (slot) => {
    setBusySlot(slot); setError(null); setSaved(null);
    try { const data = await removeHomePicture(getStoredToken(), slot); setPictures(data.pictures); setConfirming(null); setSaved(`The ${LABELS[slot]} picture was removed: the home page shows its icon again (within about a minute).`); }
    catch (err) { if (!expired(err)) setError(err.message); } finally { setBusySlot(null); }
  };

  const scale = crop ? scaleFor(crop.width, crop.height, crop.zoom) : 1;
  return (
    <div style={{ flex: 1, minWidth: 420, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
      <h2 style={{ ...body, fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>Home page pictures</h2>
      <p style={{ ...body, fontSize: 12.5, color: C.muted, margin: "6px 0 14px", lineHeight: 1.5 }}>
        Shown beside Parts, Brands, Models and Countries on the home page. Choose a picture that is at least {MIN_SOURCE_PX} × {MIN_SOURCE_PX} px (JPG, PNG or WebP); you crop it to a square and it is saved at {OUTPUT_PX} × {OUTPUT_PX}.
      </p>
      {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
      {loadState === "error" && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red }}>{error}</div>}
      {loadState === "ready" && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {SLOTS.map((slot) => {
            const url = pictures?.[slot] ?? null; const src = pictureSrc(url);
            return (
              <li key={slot} data-testid={`row-${slot}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
                <div style={{ width: 56, height: 56, borderRadius: 10, background: C.canvas, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  {src ? <img src={src} alt={`${LABELS[slot]} picture`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={22} color={C.muted} aria-hidden="true" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...body, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{LABELS[slot]}</div>
                  <div style={{ ...body, fontSize: 12, color: C.muted }}>{url ? "Picture set" : "No picture: the icon is shown"}</div>
                </div>
                {confirming === slot ? (
                  <>
                    <span style={{ ...body, fontSize: 12.5, color: C.ink }}>Remove the {LABELS[slot]} picture?</span>
                    <button type="button" style={{ ...primary, background: C.red, borderColor: C.red }} disabled={busySlot === slot} onClick={() => remove(slot)}>Remove</button>
                    <button type="button" style={button} onClick={() => setConfirming(null)}>Keep</button>
                  </>
                ) : (
                  <>
                    <label style={url ? button : primary}>
                      {url ? "Replace" : "Choose picture"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" data-testid={`file-${slot}`} aria-label={`${url ? "Replace" : "Choose"} the ${LABELS[slot]} picture`} style={{ display: "none" }} onChange={(e) => choose(slot, e)} />
                    </label>
                    {url && <button type="button" style={button} onClick={() => setConfirming(slot)}>Remove</button>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {loadState === "ready" && error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, marginTop: 10 }}>{error}</div>}
      {saved && <div role="status" style={{ ...body, fontSize: 12.5, color: "#16794F", marginTop: 10 }}>{saved}</div>}

      {crop && (
        <div role="dialog" aria-modal="true" aria-label={`Crop the picture for ${LABELS[crop.slot]}`} style={{ position: "fixed", inset: 0, background: "rgba(10,20,30,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: FRAME_PX + 40, maxWidth: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ ...body, fontSize: 14.5, fontWeight: 700, color: C.ink, margin: 0 }}>Crop the picture for “{LABELS[crop.slot]}”</h3>
              <button type="button" aria-label="Close" style={{ ...button, padding: 4, borderWidth: 0 }} onClick={close}><X size={16} /></button>
            </div>
            <div tabIndex={0} role="group" aria-label="Square frame: drag the picture, or use the arrow keys, to choose what is inside"
              style={{ position: "relative", width: FRAME_PX, height: FRAME_PX, overflow: "hidden", borderRadius: 8, border: `2px solid ${C.ink}`, background: C.canvas, cursor: "grab", touchAction: "none", margin: "0 auto" }}
              onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture?.(e.pointerId); }}
              onPointerMove={(e) => { if (!drag.current) return; move(e.clientX - drag.current.x, e.clientY - drag.current.y); drag.current = { x: e.clientX, y: e.clientY }; }}
              onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
              onKeyDown={(e) => { const d = { ArrowLeft: [KEY_STEP_PX, 0], ArrowRight: [-KEY_STEP_PX, 0], ArrowUp: [0, KEY_STEP_PX], ArrowDown: [0, -KEY_STEP_PX] }[e.key]; if (d) { e.preventDefault(); move(d[0], d[1]); } }}>
              <img src={crop.url} alt="" draggable={false} style={{ position: "absolute", left: 0, top: 0, width: crop.width * scale, height: crop.height * scale, maxWidth: "none", transform: `translate(${crop.offset.x}px, ${crop.offset.y}px)`, userSelect: "none", pointerEvents: "none" }} />
            </div>
            <label style={{ ...body, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: C.muted, margin: "14px 0 8px" }}>
              Zoom
              <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step="0.01" value={crop.zoom} aria-label="Zoom" style={{ flex: 1 }} onChange={(e) => setZoom(Number(e.target.value))} />
            </label>
            <div style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 12 }}>Original {crop.width} × {crop.height} px. The result will be {OUTPUT_PX} × {OUTPUT_PX} px.</div>
            {cropError && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, marginBottom: 10 }}>{cropError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" style={button} onClick={close} disabled={saving}>Cancel</button>
              <button type="button" style={primary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Use this crop"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
