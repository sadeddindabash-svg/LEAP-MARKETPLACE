import React, { useState, useRef } from "react";
import { X } from "lucide-react";
import { C, body } from "./theme";
import { FRAME_PX, MIN_ZOOM, MAX_ZOOM, scaleFor, clampOffset, centeredOffset, zoomKeepingCentre, sourceRect } from "./homePictureCrop";

// A window for choosing the square part of a picture: drag it (or use the arrow keys) and zoom with the slider. "Use this crop" hands the chosen square (in the original picture's pixels) back; the caller cuts it out
// and saves it. The same arithmetic as the Home page pictures (homePictureCrop.js).
const KEY_STEP_PX = 10;
const button = { ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: C.line, background: "#fff", color: C.ink };
const primary = { ...button, background: C.ink, color: "#fff", borderColor: C.ink };

export default function CropDialog({ title, image, resultText, saving, error, onCancel, onUse }) {
  const { url, width, height } = image;
  const [zoom, setZoomState] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState(() => centeredOffset(width, height, MIN_ZOOM));
  const drag = useRef(null);
  const move = (dx, dy) => setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }, width, height, zoom));
  const setZoom = (z) => { setOffset((o) => zoomKeepingCentre(o, width, height, zoom, z)); setZoomState(z); };
  const scale = scaleFor(width, height, zoom);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, background: "rgba(10,20,30,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: FRAME_PX + 40, maxWidth: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ ...body, fontSize: 14.5, fontWeight: 700, color: C.ink, margin: 0 }}>{title}</h3>
          <button type="button" aria-label="Close" style={{ ...button, padding: 4, borderWidth: 0 }} onClick={onCancel}><X size={16} /></button>
        </div>
        <div tabIndex={0} role="group" aria-label="Square frame: drag the picture, or use the arrow keys, to choose what is inside"
          style={{ position: "relative", width: FRAME_PX, height: FRAME_PX, overflow: "hidden", borderRadius: 8, borderWidth: 2, borderStyle: "solid", borderColor: C.ink, background: C.canvas, cursor: "grab", touchAction: "none", margin: "0 auto" }}
          onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture?.(e.pointerId); }}
          onPointerMove={(e) => { if (!drag.current) return; move(e.clientX - drag.current.x, e.clientY - drag.current.y); drag.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={(e) => { const d = { ArrowLeft: [KEY_STEP_PX, 0], ArrowRight: [-KEY_STEP_PX, 0], ArrowUp: [0, KEY_STEP_PX], ArrowDown: [0, -KEY_STEP_PX] }[e.key]; if (d) { e.preventDefault(); move(d[0], d[1]); } }}>
          <img src={url} alt="" draggable={false} style={{ position: "absolute", left: 0, top: 0, width: width * scale, height: height * scale, maxWidth: "none", transform: `translate(${offset.x}px, ${offset.y}px)`, userSelect: "none", pointerEvents: "none" }} />
        </div>
        <label style={{ ...body, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: C.muted, margin: "14px 0 8px" }}>Zoom
          <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step="0.01" value={zoom} aria-label="Zoom" style={{ flex: 1 }} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        <div style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 12 }}>Original {width} × {height} px. {resultText}</div>
        {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" style={button} onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="button" style={primary} onClick={() => onUse(sourceRect(offset, width, height, zoom))} disabled={saving}>{saving ? "Saving…" : "Use this crop"}</button>
        </div>
      </div>
    </div>
  );
}
