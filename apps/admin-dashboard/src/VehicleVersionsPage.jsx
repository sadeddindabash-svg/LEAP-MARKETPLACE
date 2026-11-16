import React, { useEffect, useState } from "react";
import { ImagePlus, Pencil, X, Plus, MoreHorizontal, Users, Gauge } from "lucide-react";
import { C, body, disp, mono } from "./theme";
import { API_BASE_URL, SessionExpiredError, getStoredToken, fetchVersionsForGeneration, createVersion, updateVersion, updateVersionPhoto, deleteVersion, uploadCatalogImage } from "./auth";
import { VersionForm } from "./VersionsPanel";

// patch-vehicle-data-redesign: Vehicle Data > Brands > a brand > a model > a YEAR: its versions, as cards (photo, the name in English, Arabic and Chinese,
// the engine and the seats). Each card has a "..." menu: Edit, Add/Replace photo, Delete. "+ Add version" opens the same form as before (all six texts and the
// seats required, and a photo of at least 400 px). onChanged tells the year list that the number of versions (or of photos) changed.
const mediaSrc = (url) => (url.startsWith("http") ? url : `${API_BASE_URL}${url}`);

export default function VehicleVersionsPage({ generation, carLabel, onSessionExpired, onChanged }) {
  const [versions, setVersions] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [replacingPhotoId, setReplacingPhotoId] = useState(null);
  const [menuId, setMenuId] = useState(null);

  const load = () => fetchVersionsForGeneration(generation.id).then((v) => { setVersions(v); setLoadError(null); if (v.length === 0) setAdding(true); }).catch((e) => setLoadError(e.message));
  useEffect(() => { load(); }, [generation.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (menuId === null) return undefined;
    const onDown = (e) => { if (!(e.target.closest && e.target.closest("[data-version-menu]"))) setMenuId(null); };
    const onKey = (e) => { if (e.key === "Escape") setMenuId(null); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuId]);
  const guard = (err) => { if (err instanceof SessionExpiredError) { onSessionExpired(); return; } setError(err.message); };
  const changed = async () => { await load(); if (onChanged) onChanged(); };

  const handleAdd = async (fields, photoFile) => {
    setBusy(true); setError(null);
    try {
      const token = getStoredToken();
      const upload = await uploadCatalogImage(token, photoFile);       // the photo first: a refused picture creates nothing
      await createVersion(token, generation.id, { ...fields, photoUrl: upload.url });
      setAdding(false);
      await changed();
    } catch (err) { guard(err); } finally { setBusy(false); }
  };
  const handleEdit = async (id, fields, photoFile) => {
    setBusy(true); setError(null);
    try {
      const token = getStoredToken();
      await updateVersion(token, id, fields);
      if (photoFile) { const upload = await uploadCatalogImage(token, photoFile); await updateVersionPhoto(token, id, upload.url); }
      setEditingId(null);
      await changed();
    } catch (err) { guard(err); } finally { setBusy(false); }
  };
  const handleReplacePhoto = async (id, file) => {
    if (!file) return;
    setReplacingPhotoId(id); setError(null);
    try {
      const token = getStoredToken();
      const upload = await uploadCatalogImage(token, file);
      await updateVersionPhoto(token, id, upload.url);
      await changed();
    } catch (err) { guard(err); } finally { setReplacingPhotoId(null); }
  };
  const handleDelete = async (id) => {
    setError(null);
    try { await deleteVersion(getStoredToken(), id); setConfirmDeleteId(null); await changed(); } catch (err) { guard(err); setConfirmDeleteId(null); }
  };

  const list = versions || [];
  const noPhoto = list.filter((v) => !v.photoUrl).length;
  const menuItem = { ...body, display: "flex", alignItems: "center", gap: 9, width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 7, border: "none", background: "none", fontSize: 13, fontWeight: 700, color: C.ink, cursor: "pointer", textAlign: "left" };
  const chip = (icon, text) => <span style={{ ...body, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: C.ink, background: C.canvas, border: `1px solid ${C.line}`, borderRadius: 999, padding: "3px 9px" }}>{icon}{text}</span>;

  return (
    <div data-testid="versions-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ ...disp, fontSize: 18, fontWeight: 800, color: C.ink }}>Versions of {carLabel}</div>
          <div style={{ ...body, fontSize: 12.5, color: C.muted, marginTop: 2 }}>
            {versions === null ? "Loading…" : `${list.length} ${list.length === 1 ? "version" : "versions"}`}
            {noPhoto > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: C.amberInk, background: C.amberBg, borderRadius: 999, padding: "2px 8px", marginLeft: 8 }}>{noPhoto} without photo</span>}
          </div>
        </div>
        {!adding && (
          <button onClick={() => { setAdding(true); setEditingId(null); setError(null); }} style={{ ...body, marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: `1px solid ${C.signalDark}`, background: C.signal, color: C.onSignal, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
            <Plus size={15} /> Add version
          </button>
        )}
      </div>

      {loadError && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.redInk, background: C.redBg, borderRadius: 10, padding: "9px 12px", marginBottom: 12 }}>{loadError}</div>}
      {error && editingId === null && !adding && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.redInk, background: C.redBg, borderRadius: 10, padding: "9px 12px", marginBottom: 12 }}>{error}</div>}

      {adding && (
        <div style={{ border: `1px solid ${C.signal}`, background: C.goldTint, borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...disp, fontSize: 14.5, fontWeight: 800, color: C.ink }}>Add a version to {carLabel}</span>
            {list.length > 0 && <button onClick={() => { setAdding(false); setError(null); }} style={{ ...body, marginLeft: "auto", background: "none", border: "none", color: C.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Cancel</button>}
          </div>
          <div style={{ ...body, fontSize: 11.5, color: C.muted, marginTop: 2 }}>The version name and the engine in English, Arabic and Chinese, the seats, and a photo (at least 400 px).</div>
          <VersionForm key={list.length} requirePhoto submitLabel="Add version" busy={busy && editingId === null} error={error} onSubmit={handleAdd} />
        </div>
      )}

      {versions !== null && list.length === 0 && !adding && <div style={{ ...body, fontSize: 13, color: C.muted, textAlign: "center", padding: 30, border: `1px dashed ${C.lineStrong}`, borderRadius: 12 }}>No versions yet.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
        {list.map((v) => editingId === v.id ? (
          <div key={v.id} style={{ gridColumn: "1 / -1", border: `1px solid ${C.torque}`, borderRadius: 14, padding: 14, background: "#fff" }}>
            <div style={{ ...disp, fontSize: 14.5, fontWeight: 800, color: C.ink }}>Edit {v.name}</div>
            <VersionForm initial={v} submitLabel="Save" busy={busy} error={error} onCancel={() => { setEditingId(null); setError(null); }} onSubmit={(fields, photoFile) => handleEdit(v.id, fields, photoFile)} />
          </div>
        ) : (
          <div key={v.id} data-testid="version-card" style={{ position: "relative", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, overflow: "visible", boxShadow: "0 1px 2px rgba(11,49,70,0.05)" }}>
            <div style={{ position: "relative", aspectRatio: "16 / 10", background: C.canvas, borderRadius: "14px 14px 0 0", overflow: "hidden" }}>
              {v.photoUrl
                ? <img src={mediaSrc(v.photoUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: replacingPhotoId === v.id ? 0.4 : 1 }} />
                : (
                  <label style={{ ...body, position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: C.amberInk, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                    <ImagePlus size={22} /> {replacingPhotoId === v.id ? "Uploading…" : "Add photo"}
                    <input type="file" aria-label={`Add photo for ${v.name}`} accept="image/jpeg,image/png,image/webp" disabled={replacingPhotoId === v.id} onChange={(e) => handleReplacePhoto(v.id, e.target.files?.[0])} style={{ display: "none" }} />
                  </label>
                )}
              {!v.photoUrl && <span style={{ ...body, position: "absolute", left: 10, top: 10, fontSize: 10.5, fontWeight: 800, color: C.amberInk, background: C.amberBg, borderRadius: 999, padding: "2px 8px" }}>No photo yet</span>}
            </div>
            <button type="button" data-version-menu="" onClick={() => setMenuId(menuId === v.id ? null : v.id)} aria-label={`${v.name} options`} aria-haspopup="menu" aria-expanded={menuId === v.id}
              style={{ position: "absolute", right: 10, top: 10, width: 30, height: 30, borderRadius: 9, border: `1px solid ${C.line}`, background: menuId === v.id ? C.navy : "rgba(255,255,255,0.95)", color: menuId === v.id ? "#fff" : C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
              <MoreHorizontal size={16} />
            </button>
            {menuId === v.id && (
              <div role="menu" data-version-menu="" style={{ position: "absolute", right: 10, top: 46, zIndex: 30, minWidth: 180, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 10px 28px rgba(7,32,47,0.18)", padding: 5 }}>
                <button type="button" role="menuitem" onClick={() => { setMenuId(null); setAdding(false); setEditingId(v.id); setError(null); }} style={menuItem}><Pencil size={14} color={C.torque} /> Edit</button>
                <label role="menuitem" style={menuItem}>
                  <ImagePlus size={14} color={C.navy} /> {v.photoUrl ? "Replace photo" : "Add photo"}
                  <input type="file" aria-label={`${v.photoUrl ? "Replace" : "Add"} photo for ${v.name}`} accept="image/jpeg,image/png,image/webp" onChange={(e) => { setMenuId(null); handleReplacePhoto(v.id, e.target.files?.[0]); }} style={{ display: "none" }} />
                </label>
                <div style={{ height: 1, background: C.line, margin: "4px 2px" }} />
                <button type="button" role="menuitem" onClick={() => { setMenuId(null); setConfirmDeleteId(v.id); }} style={{ ...menuItem, color: C.red }}><X size={14} color={C.red} /> Delete</button>
              </div>
            )}
            <div style={{ padding: "12px 14px 14px" }}>
              <div style={{ ...disp, fontSize: 15, fontWeight: 800, color: C.ink }}>{v.name}</div>
              <div style={{ ...body, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: C.muted, marginTop: 2 }}>
                <span dir="rtl">{v.nameAr}</span><span>{v.nameZh}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {chip(<Gauge size={12} color={C.muted} />, v.engine)}
                {chip(<Users size={12} color={C.muted} />, `${v.seats} seats`)}
              </div>
              {confirmDeleteId === v.id && (
                <div role="alert" style={{ ...body, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.redInk, background: C.redBg, borderRadius: 8, padding: "7px 10px", marginTop: 10 }}>
                  Delete {v.name}?
                  <button onClick={() => handleDelete(v.id)} style={{ ...body, marginLeft: "auto", border: "none", background: C.red, color: "#fff", borderRadius: 6, padding: "4px 10px", fontWeight: 800, cursor: "pointer" }}>Delete</button>
                  <button onClick={() => setConfirmDeleteId(null)} style={{ ...body, border: "none", background: "none", color: C.muted, fontWeight: 700, cursor: "pointer" }}>Keep</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
