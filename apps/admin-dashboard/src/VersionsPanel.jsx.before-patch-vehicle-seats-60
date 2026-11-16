import React, { useState } from "react";
import { ChevronDown, ChevronRight, ImagePlus, Pencil, X, Check } from "lucide-react";
import { C, body } from "./theme";
import { API_BASE_URL, SessionExpiredError, getStoredToken, fetchVersionsForGeneration, createVersion, updateVersion, updateVersionPhoto, deleteVersion, uploadCatalogImage } from "./auth";

// The VERSIONS of one vehicle year (version name, engine, seats, photo), added by hand. Each of the six texts is written in English, Arabic and Chinese (all required), seats are
// a number from 1 to 12, and the photo is required when adding (the shortest side at least 400 px). A version that arrived from the Excel import without a picture is marked
// "No photo yet" and gets its picture here ("Add photo").
const EMPTY = { name: "", nameAr: "", nameZh: "", engine: "", engineAr: "", engineZh: "", seats: "" };
const mediaSrc = (url) => (url.startsWith("http") ? url : `${API_BASE_URL}${url}`);

function VersionForm({ initial = EMPTY, requirePhoto, submitLabel, onSubmit, onCancel, busy, error }) {
  const [values, setValues] = useState({ ...EMPTY, ...initial, seats: initial.seats === undefined || initial.seats === null ? "" : String(initial.seats) });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [problem, setProblem] = useState(null);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const input = { ...body, boxSizing: "border-box", width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5, color: C.ink, background: C.card };

  const submit = () => {
    for (const [key, label] of [["name", "Version name"], ["engine", "Engine"]]) {
      for (const [suffix, lang] of [["", "English"], ["Ar", "Arabic"], ["Zh", "Chinese"]]) {
        if (!values[key + suffix].trim()) { setProblem(`${label} in ${lang} is required.`); return; }
      }
    }
    if (!/^\d{1,2}$/.test(values.seats.trim()) || Number(values.seats) < 1 || Number(values.seats) > 12) { setProblem("Seats must be a whole number from 1 to 12."); return; }
    if (requirePhoto && !photoFile) { setProblem("A photo is required."); return; }
    setProblem(null);
    onSubmit({ ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])), seats: Number(values.seats) }, photoFile);
  };
  const row = (label, key) => (
    <div style={{ display: "grid", gridTemplateColumns: "70px repeat(3, minmax(0, 1fr))", gap: 8, alignItems: "center", marginBottom: 8 }}>
      <span style={{ ...body, fontSize: 12, color: C.muted }}>{label}</span>
      <input aria-label={`${label} (English)`} value={values[key]} onChange={set(key)} placeholder="English" style={input} />
      <input aria-label={`${label} (Arabic)`} dir="rtl" value={values[`${key}Ar`]} onChange={set(`${key}Ar`)} placeholder="العربية" style={input} />
      <input aria-label={`${label} (Chinese)`} value={values[`${key}Zh`]} onChange={set(`${key}Zh`)} placeholder="中文" style={input} />
    </div>
  );
  return (
    <div style={{ background: C.canvas, borderRadius: 10, padding: 12, marginTop: 8 }}>
      {row("Version", "name")}
      {row("Engine", "engine")}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
        <label style={{ ...body, fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
          Seats
          <input aria-label="Seats" inputMode="numeric" value={values.seats} onChange={set("seats")} style={{ ...input, width: 70 }} />
        </label>
        <label style={{ ...body, display: "flex", alignItems: "center", gap: 6, border: `1px solid ${requirePhoto && !photoFile ? C.red : C.line}`, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: C.ink, background: C.card }}>
          <ImagePlus size={14} />
          {photoFile ? "Photo selected" : requirePhoto ? "Choose photo (required, at least 400 px)" : "Choose a new photo (at least 400 px)"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); } }} style={{ display: "none" }} />
        </label>
        {photoPreview && <img src={photoPreview} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />}
        <button disabled={busy} onClick={submit} style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: busy ? "#D1D5DB" : C.signal, color: C.onSignal, fontSize: 12.5, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
          <Check size={13} /> {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && <button onClick={onCancel} style={{ ...body, background: "none", border: "none", color: C.muted, fontSize: 12.5, cursor: "pointer" }}>Cancel</button>}
      </div>
      {(problem || error) && <div role="alert" style={{ ...body, fontSize: 12, color: C.red, background: "#FBE7E5", borderRadius: 8, padding: 8, marginTop: 8 }}>{problem || error}</div>}
    </div>
  );
}

export default function VersionsPanel({ generation, onSessionExpired }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState(null);       // null = not loaded yet
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [replacingPhotoId, setReplacingPhotoId] = useState(null);

  const load = () => fetchVersionsForGeneration(generation.id).then((v) => { setVersions(v); setLoadError(null); }).catch((e) => setLoadError(e.message));
  // reloaded every time it is opened: another admin (or an import) may have changed the list since
  const toggle = () => { const next = !open; setOpen(next); if (next) load(); };
  const guard = (err) => { if (err instanceof SessionExpiredError) { onSessionExpired(); return; } setError(err.message); };

  const handleAdd = async (fields, photoFile) => {
    setBusy(true); setError(null);
    try {
      const token = getStoredToken();
      const upload = await uploadCatalogImage(token, photoFile);       // the photo first: a refused picture creates nothing
      await createVersion(token, generation.id, { ...fields, photoUrl: upload.url });
      await load();
    } catch (err) { guard(err); } finally { setBusy(false); }
  };
  const handleEdit = async (id, fields, photoFile) => {
    setBusy(true); setError(null);
    try {
      const token = getStoredToken();
      await updateVersion(token, id, fields);
      if (photoFile) { const upload = await uploadCatalogImage(token, photoFile); await updateVersionPhoto(token, id, upload.url); }
      setEditingId(null);
      await load();
    } catch (err) { guard(err); } finally { setBusy(false); }
  };
  const handleReplacePhoto = async (id, file) => {
    if (!file) return;
    setReplacingPhotoId(id); setError(null);
    try {
      const token = getStoredToken();
      const upload = await uploadCatalogImage(token, file);
      await updateVersionPhoto(token, id, upload.url);
      await load();
    } catch (err) { guard(err); } finally { setReplacingPhotoId(null); }
  };
  const handleDelete = async (id) => {
    setError(null);
    try { await deleteVersion(getStoredToken(), id); setConfirmDeleteId(null); await load(); } catch (err) { guard(err); setConfirmDeleteId(null); }
  };

  const noPhoto = (versions || []).filter((v) => !v.photoUrl).length;
  return (
    <div style={{ borderBottom: `1px solid ${C.line}` }}>
      <button onClick={toggle} aria-expanded={open} aria-label={`Versions of ${generation.name}`} style={{ ...body, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "4px 12px 8px 50px", fontSize: 12, fontWeight: 700, color: C.muted }}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Versions{versions !== null ? ` (${versions.length})` : ""}
        {open && noPhoto > 0 && <span style={{ fontSize: 11, color: "#8A5A12", background: "#FDF3E1", borderRadius: 999, padding: "2px 8px" }}>{noPhoto} without photo</span>}
      </button>
      {open && (
        <div style={{ padding: "0 12px 14px 50px" }}>
          {loadError && <div role="alert" style={{ ...body, fontSize: 12, color: C.red, marginBottom: 8 }}>{loadError}</div>}
          {versions !== null && versions.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: "4px 0 8px" }}>No versions yet.</div>}
          {(versions || []).map((v) => (
            <div key={v.id} style={{ borderBottom: `1px solid ${C.line}`, padding: "8px 0" }}>
              {editingId === v.id ? (
                <VersionForm initial={v} submitLabel="Save" busy={busy} error={error} onCancel={() => { setEditingId(null); setError(null); }} onSubmit={(fields, photoFile) => handleEdit(v.id, fields, photoFile)} />
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {v.photoUrl ? <img src={mediaSrc(v.photoUrl)} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 36, height: 36, borderRadius: 6, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ImagePlus size={13} color={C.muted} /></div>}
                    <div style={{ minWidth: 0 }}>
                      <div><span style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink }}>{v.name}</span><span dir="rtl" style={{ ...body, fontSize: 11.5, color: C.muted, marginLeft: 8 }}>{v.nameAr}</span><span style={{ ...body, fontSize: 11.5, color: C.muted, marginLeft: 8 }}>{v.nameZh}</span></div>
                      <div style={{ ...body, fontSize: 11.5, color: C.muted }}>{v.engine} · {v.seats} seats</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ ...body, fontSize: 11, fontWeight: 700, color: v.photoUrl ? "#16794F" : "#8A5A12", background: v.photoUrl ? "#E6F5EE" : "#FDF3E1", borderRadius: 999, padding: "3px 9px" }}>{v.photoUrl ? "Has photo" : "No photo yet"}</span>
                    <label style={{ ...body, fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "5px 11px", cursor: "pointer", border: v.photoUrl ? `1px solid ${C.line}` : "none", background: v.photoUrl ? C.card : C.signal, color: v.photoUrl ? C.ink : C.onSignal }}>
                      {replacingPhotoId === v.id ? "Uploading…" : v.photoUrl ? "Replace photo" : "Add photo"}
                      <input type="file" aria-label={`${v.photoUrl ? "Replace" : "Add"} photo for ${v.name}`} accept="image/jpeg,image/png,image/webp" disabled={replacingPhotoId === v.id} onChange={(e) => handleReplacePhoto(v.id, e.target.files?.[0])} style={{ display: "none" }} />
                    </label>
                    <button onClick={() => { setEditingId(v.id); setError(null); }} aria-label={`Edit ${v.name}`} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Pencil size={13} color={C.muted} /></button>
                    {confirmDeleteId === v.id ? (
                      <span style={{ ...body, fontSize: 12 }}>Delete? <button onClick={() => handleDelete(v.id)} style={{ ...body, border: "none", background: "none", color: C.red, fontWeight: 700, cursor: "pointer" }}>Yes</button> <button onClick={() => setConfirmDeleteId(null)} style={{ ...body, border: "none", background: "none", color: C.muted, cursor: "pointer" }}>No</button></span>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(v.id)} aria-label={`Delete ${v.name}`} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={14} color={C.red} /></button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {error && editingId === null && <div role="alert" style={{ ...body, fontSize: 12, color: C.red, background: "#FBE7E5", borderRadius: 8, padding: 8, marginTop: 8 }}>{error}</div>}
          <div style={{ ...body, fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 12 }}>Add a version to {generation.name}</div>
          <VersionForm key={versions ? versions.length : 0} requirePhoto submitLabel="Add version" busy={busy && editingId === null} error={null} onSubmit={handleAdd} />
        </div>
      )}
    </div>
  );
}
