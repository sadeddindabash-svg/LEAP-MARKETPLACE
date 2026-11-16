import React, { useState, useEffect, useCallback, useRef } from "react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken } from "./auth";
import { fetchAdminCategories, fetchAdminParts, editCategoryDetails, editPartDetails, reviewPartSizes } from "./catalogAdminApi";

// "Edit details" on the Categories page: pick a category, see its parts, and correct ANY field of a category or a part (names in three languages, code, sub-category, placement, allowed positions,
// applies-to, special shipping, keywords, size and weight). The same naming rules as the import apply; the server refuses a change that breaks them and says why. A rename of a part carries the
// products that use it along; a size a person types becomes "measured" (no longer an estimate).
const POSITIONS = ["Front", "Rear", "Left", "Right", "Front-Left", "Front-Right", "Rear-Left", "Rear-Right", "Universal"];
const PART_TEXT = [
  ["nameEn", "English name"], ["nameAr", "Arabic name", "rtl"], ["nameZh", "Chinese name"], ["code", "Code"],
  ["subcategoryEn", "Sub-category (English)"], ["subcategoryAr", "Sub-category (Arabic)", "rtl"], ["subcategoryZh", "Sub-category (Chinese)"],
  ["placementEn", "Placement (English)"], ["placementAr", "Placement (Arabic)", "rtl"], ["placementZh", "Placement (Chinese)"],
  ["appliesTo", "Applies to"], ["specialShipping", "Special shipping"], ["keywordsEn", "Keywords (English)"], ["keywordsAr", "Keywords (Arabic)", "rtl"], ["keywordsZh", "Keywords (Chinese)"],
];
const SIZES = [["weightKg", "Weight (kg)"], ["lengthCm", "Length (cm)"], ["widthCm", "Width (cm)"], ["heightCm", "Height (cm)"]];
const CATEGORY_TEXT = [["code", "Code"], ["nameEn", "English name"], ["nameAr", "Arabic name", "rtl"], ["nameZh", "Chinese name"]];
const sameList = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export default function CatalogEditorPanel({ onSessionExpired }) {
  const [categories, setCategories] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [parts, setParts] = useState([]);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);            // { kind, original, values }
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const editingId = editing ? editing.original.id : null;
  useEffect(() => { if (editingId && formRef.current && formRef.current.scrollIntoView) formRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [editingId]);       // the form opens below a long list: bring it into view

  const fail = useCallback((err) => { if (err instanceof SessionExpiredError) { onSessionExpired(); return; } setError(err.message); }, [onSessionExpired]);
  useEffect(() => { fetchAdminCategories(getStoredToken()).then(setCategories).catch(fail); }, [fail]);
  useEffect(() => { if (selectedId) fetchAdminParts(getStoredToken(), selectedId).then(setParts).catch(fail); else setParts([]); }, [selectedId, fail]);

  const startEdit = (kind, original) => { setMessage(null); setError(null); setEditing({ kind, original, values: { ...original, allowedPositions: [...(original.allowedPositions || [])] } }); };
  const setValue = (key, value) => setEditing((e) => ({ ...e, values: { ...e.values, [key]: value } }));
  const togglePosition = (p) => setEditing((e) => { const has = e.values.allowedPositions.includes(p); return { ...e, values: { ...e.values, allowedPositions: has ? e.values.allowedPositions.filter((x) => x !== p) : [...e.values.allowedPositions, p] } }; });

  /** Only what the person changed is sent; if any of the four size fields changed, all four go together (the server wants them together). */
  const changesOf = () => {
    const { kind, original, values } = editing, out = {};
    for (const [key] of kind === "part" ? PART_TEXT : CATEGORY_TEXT) if ((values[key] ?? "") !== (original[key] ?? "")) out[key] = values[key];
    if (kind === "part") {
      if (!sameList(values.allowedPositions, original.allowedPositions || [])) out.allowedPositions = values.allowedPositions;
      if (SIZES.some(([k]) => String(values[k] ?? "") !== String(original[k] ?? ""))) for (const [k] of SIZES) out[k] = Number(values[k]);
    }
    return out;
  };
  const save = async () => {
    const changes = changesOf();
    if (Object.keys(changes).length === 0) { setError(null); setMessage("Nothing to save: no field was changed."); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      const token = getStoredToken();
      if (editing.kind === "category") {
        const saved = await editCategoryDetails(token, editing.original.id, changes);
        setCategories((list) => list.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)));
        setMessage("Category saved.");
      } else {
        const saved = await editPartDetails(token, editing.original.id, changes);
        setParts((list) => list.map((p) => (p.id === saved.id ? saved : p)));
        setMessage(`Part saved.${saved.productsRenamed ? ` ${saved.productsRenamed} product(s) that use it now carry the new name.` : ""}${saved.productsAffectedBySize ? ` The shipping of ${saved.productsAffectedBySize} product(s) that rely on this part's size changes.` : ""}${changes.weightKg !== undefined ? " Its size is now marked as measured." : ""}`);
      }
      setEditing(null);
    } catch (err) { fail(err); } finally { setBusy(false); }
  };
  const markReviewed = async () => {
    setBusy(true); setError(null);
    try {
      await reviewPartSizes(getStoredToken(), [editing.original.id]);
      const updated = { ...editing.original, sizeBasis: "measured" };
      setParts((list) => list.map((p) => (p.id === updated.id ? updated : p)));
      setEditing((e) => ({ ...e, original: updated, values: { ...e.values, sizeBasis: "measured" } })); setMessage("Size marked as reviewed (measured).");
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const box = { border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, background: C.card, marginBottom: 14 };
  const button = (primary, disabled) => ({ ...body, padding: "7px 13px", borderRadius: 8, border: primary ? "none" : `1px solid ${C.line}`, background: disabled ? "#D1D5DB" : primary ? C.ink : "#fff", color: primary ? "#fff" : C.ink, fontWeight: 600, fontSize: 12.5, cursor: disabled ? "default" : "pointer" });
  const input = { ...body, fontSize: 13, padding: "6px 8px", border: `1px solid ${C.line}`, borderRadius: 6, width: "100%", boxSizing: "border-box" };
  const chip = (text, color, bg) => <span style={{ fontSize: 10.5, fontWeight: 700, color, background: bg, borderRadius: 999, padding: "1px 7px", marginLeft: 6 }}>{text}</span>;
  const visibleParts = parts.filter((p) => !filter || `${p.code} ${p.nameEn} ${p.nameAr} ${p.nameZh} ${p.subcategoryEn}`.toLowerCase().includes(filter.toLowerCase()));
  const selected = categories?.find((c) => c.id === selectedId);

  return (
    <div>
      {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, background: "#FBE7E5", borderRadius: 8, padding: 10, marginBottom: 12 }}>{error}</div>}
      {message && <div role="status" style={{ ...body, fontSize: 12.5, color: "#16794F", background: "#E6F5EE", borderRadius: 8, padding: 10, marginBottom: 12 }}>{message}</div>}

      <div style={box}>
        <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Categories {categories ? `(${categories.length})` : ""}</div>
        {!categories && !error && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(categories || []).map((c) => (
            <button key={c.id} onClick={() => { setSelectedId(c.id); setEditing(null); setFilter(""); }} aria-pressed={selectedId === c.id}
              style={{ ...body, fontSize: 12.5, padding: "5px 10px", borderRadius: 8, border: `1px solid ${selectedId === c.id ? C.ink : C.line}`, background: selectedId === c.id ? C.ink : "#fff", color: selectedId === c.id ? "#fff" : C.ink, cursor: "pointer" }}>
              {c.nameEn}<span style={{ opacity: 0.7 }}> · {c.partCount}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div style={box}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink }}>{selected.nameEn} {selected.code ? <span style={{ color: C.muted, fontWeight: 400 }}>({selected.code})</span> : null}
              {selected.hasPlaceholderPhoto && chip("photo placeholder", "#8A5A12", "#FDF3E1")}</div>
            <button onClick={() => startEdit("category", selected)} style={button(false, false)}>Edit category</button>
            <input aria-label="Filter parts" placeholder="Filter the parts" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...input, width: 220, marginLeft: "auto" }} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", ...body, fontSize: 12 }}>
              <thead><tr>{["Code", "Part", "Sub-category", "Positions", "Size and weight", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${C.line}`, color: C.muted, fontWeight: 700 }}>{h}</th>)}</tr></thead>
              <tbody>
                {visibleParts.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{p.code || "—"}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{p.nameEn}{p.hasPlaceholderPhoto && chip("placeholder", "#8A5A12", "#FDF3E1")}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{p.subcategoryEn || "—"}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{p.allowedPositions.length ? p.allowedPositions.join(", ") : "any"}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{p.weightKg === null ? "—" : `${p.lengthCm} x ${p.widthCm} x ${p.heightCm} cm, ${p.weightKg} kg`}{p.sizeBasis === "estimate" && chip("estimate", "#8A5A12", "#FDF3E1")}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}><button aria-label={`Edit ${p.nameEn}`} onClick={() => startEdit("part", p)} style={button(false, false)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleParts.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted, marginTop: 8 }}>No parts to show.</div>}
        </div>
      )}

      {editing && (
        <div ref={formRef} style={{ ...box, borderColor: C.ink }} aria-label={editing.kind === "part" ? "Edit part" : "Edit category"} role="group">
          <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>{editing.kind === "part" ? `Edit part: ${editing.original.nameEn}` : `Edit category: ${editing.original.nameEn}`}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {(editing.kind === "part" ? PART_TEXT : CATEGORY_TEXT).map(([key, label, dir]) => (
              <div key={key} style={{ flex: "1 1 220px" }}>
                <div style={{ ...body, fontSize: 11.5, color: C.muted, marginBottom: 2 }}>{label}</div>
                <input aria-label={label} dir={dir} value={editing.values[key] ?? ""} onChange={(e) => setValue(key, e.target.value)} style={input} />
              </div>
            ))}
          </div>
          {editing.kind === "part" && (
            <>
              <div style={{ ...body, fontSize: 11.5, color: C.muted, margin: "12px 0 4px" }}>Allowed positions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {POSITIONS.map((p) => <label key={p} style={{ ...body, fontSize: 12.5, color: C.ink, display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" aria-label={`Position ${p}`} checked={editing.values.allowedPositions.includes(p)} onChange={() => togglePosition(p)} /> {p}</label>)}
              </div>
              <div style={{ ...body, fontSize: 11.5, color: C.muted, margin: "12px 0 4px" }}>Packed size and weight {editing.original.sizeBasis === "estimate" ? "(currently an estimate: typing a value marks it as measured)" : editing.original.sizeBasis === "measured" ? "(measured)" : ""}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                {SIZES.map(([key, label]) => (
                  <div key={key} style={{ flex: "0 1 130px" }}>
                    <div style={{ ...body, fontSize: 11.5, color: C.muted, marginBottom: 2 }}>{label}</div>
                    <input aria-label={label} inputMode="decimal" value={editing.values[key] ?? ""} onChange={(e) => setValue(key, e.target.value)} style={input} />
                  </div>
                ))}
                {editing.original.sizeBasis === "estimate" && <button disabled={busy} onClick={markReviewed} style={button(false, busy)}>Mark size as reviewed</button>}
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button disabled={busy} onClick={save} style={button(true, busy)}>{busy ? "Saving…" : "Save"}</button>
            <button disabled={busy} onClick={() => { setEditing(null); setError(null); }} style={button(false, busy)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
