import React, { useState, useEffect, useCallback } from "react";
import { Download, FileSpreadsheet, Check, AlertTriangle, Undo2 } from "lucide-react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken } from "./auth";
import { previewCatalogImport, commitCatalogImport, downloadCatalogTemplate, fetchCatalogHealth, fetchCatalogBatches, undoCatalogBatch, previewCatalogCleanup, commitCatalogCleanup } from "./catalogAdminApi";
import { exportToExcel } from "./exportToExcel";

// "Import from Excel" on the Categories page: choose the parts catalog file, CHECK it (nothing is saved), read what will happen, then IMPORT (all or nothing). Below: how complete the
// catalog is (placeholders, estimated sizes) and the imports so far, each of which can be undone (only what it created and nothing uses).
const STATUS = {
  new: { label: "New", color: "#16794F", bg: "#E6F5EE" },
  update: { label: "Fill / update", color: "#1D4E89", bg: "#E5EEF9" },
  exists: { label: "Already exists", color: "#4B5563", bg: "#EEF0F3" },
  error: { label: "Problem", color: "#B42318", bg: "#FBE7E5" },
};
const LEVEL_COLOR = { error: "#B42318", warning: "#8A5A12", info: "#4B5563" };
const SHOWN_AT_FIRST = 100;
const sizeText = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const dims = (s) => (s ? `${s.lengthCm} x ${s.widthCm} x ${s.heightCm} cm, ${s.weightKg} kg` : "");

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function CatalogImportPanel({ onSessionExpired }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("skip");
  const [phase, setPhase] = useState("idle");              // idle | checking | checked | importing | done
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [health, setHealth] = useState(null);
  const [batches, setBatches] = useState([]);
  const [undoing, setUndoing] = useState(null);            // the batch id waiting for "yes, undo it"
  const [undone, setUndone] = useState(null);
  const [clean, setClean] = useState({ open: false, alsoProducts: false, preview: null, confirm: "", busy: false, result: null });

  const fail = useCallback((err) => {
    if (err instanceof SessionExpiredError) { onSessionExpired(); return; }
    setError(err.message);
    if (err.payload && err.payload.rows) setPreview(err.payload);       // a refusal that explains itself: show what is wrong
  }, [onSessionExpired]);
  const refresh = useCallback(async () => {
    try {
      const h = await fetchCatalogHealth(getStoredToken()); setHealth(h && h.categories && h.parts ? h : null);
      const b = await fetchCatalogBatches(getStoredToken()); setBatches(Array.isArray(b) ? b : []);
    }
    catch (err) { if (err instanceof SessionExpiredError) onSessionExpired(); }
  }, [onSessionExpired]);
  useEffect(() => { refresh(); }, [refresh]);

  const runCheck = async (theFile, theMode) => {
    setPhase("checking"); setError(null); setResult(null); setShowAll(false);
    try { setPreview(await previewCatalogImport(getStoredToken(), theFile, theMode)); setPhase("checked"); }
    catch (err) { setPreview(null); setPhase("idle"); fail(err); }
  };
  const handleTemplate = async () => {
    setError(null);
    try { downloadBlob(await downloadCatalogTemplate(getStoredToken()), "Leap_Parts_Catalog_Import_Template.xlsx"); } catch (err) { fail(err); }
  };
  const handleMode = (next) => { setMode(next); if (file && phase === "checked") runCheck(file, next); };
  const handleImport = async () => {
    setPhase("importing"); setError(null);
    try { const done = await commitCatalogImport(getStoredToken(), file, mode); setResult(done); setPreview(null); setPhase("done"); refresh(); }
    catch (err) { setPhase("checked"); fail(err); }
  };
  const handleUndo = async (id) => {
    setError(null);
    try { setUndone(await undoCatalogBatch(getStoredToken(), id)); setUndoing(null); refresh(); }
    catch (err) { setUndoing(null); fail(err); }
  };
  const loadCleanup = async (alsoProducts) => {
    setClean((c) => ({ ...c, open: true, alsoProducts, busy: true, result: null })); setError(null);
    try { const preview = await previewCatalogCleanup(getStoredToken(), alsoProducts); setClean((c) => ({ ...c, preview, busy: false })); }
    catch (err) { setClean((c) => ({ ...c, busy: false })); fail(err); }
  };
  const runCleanup = async () => {
    setClean((c) => ({ ...c, busy: true })); setError(null);
    try { const result = await commitCatalogCleanup(getStoredToken(), { confirm: clean.confirm, alsoProducts: clean.alsoProducts }); setClean((c) => ({ ...c, busy: false, result, preview: null, confirm: "" })); refresh(); }
    catch (err) { setClean((c) => ({ ...c, busy: false })); fail(err); }
  };
  const downloadRemoved = () => exportToExcel({
    sheetName: "Removed", filename: "Old_catalog_removed.xlsx",
    columns: [{ header: "Type", key: "type", width: 12 }, { header: "Id", key: "id", width: 24 }, { header: "Name", key: "name", width: 40 }, { header: "Category", key: "category", width: 24 }],
    rows: [...clean.result.removed.categories.map((r) => ({ type: "Category", id: r.id, name: r.name, category: "" })), ...clean.result.removed.parts.map((r) => ({ type: "Part", id: r.id, name: r.name, category: r.category })),
      ...clean.result.removed.products.map((r) => ({ type: "Product", id: r.id, name: r.name, category: r.category }))],
  });
  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null); setPhase("idle"); setMode("skip"); setUndone(null); };
  const handleReport = () => exportToExcel({
    sheetName: "Import check", filename: `Catalog_import_report_${preview.fileName.replace(/\.xlsx$/i, "")}.xlsx`,
    columns: [{ header: "Row", key: "row", width: 8 }, { header: "Category", key: "category", width: 16 }, { header: "Code", key: "code", width: 10 }, { header: "Part", key: "part", width: 30 }, { header: "Positions", key: "positions", width: 24 },
      { header: "Size and weight", key: "size", width: 30 }, { header: "Size basis", key: "basis", width: 11 }, { header: "Result", key: "result", width: 16 }, { header: "Messages", key: "messages", width: 80 }],
    rows: preview.rows.map((r) => ({ row: r.rowNumber, category: r.category, code: r.code, part: r.part, positions: r.positions, size: dims(r.size), basis: r.sizeBasis, result: STATUS[r.status].label, messages: r.messages.map((m) => m.text).join(" | ") })),
  });

  const box = { border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, background: C.card, marginBottom: 14 };
  const button = (primary, disabled) => ({ ...body, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: primary ? "none" : `1px solid ${C.line}`, background: disabled ? "#D1D5DB" : primary ? C.ink : "#fff", color: primary ? "#fff" : C.ink, fontWeight: 600, fontSize: 13, cursor: disabled ? "default" : "pointer" });
  const s = preview?.summary;
  const toImport = s ? s.newCategories + s.newParts + s.updatedCategories + s.updatedParts : 0;
  const shownRows = preview ? preview.rows.filter((r) => !problemsOnly || r.status === "error" || r.messages.some((m) => m.level === "warning")) : [];
  const visibleRows = showAll ? shownRows : shownRows.slice(0, SHOWN_AT_FIRST);
  const tile = (value, label, warn) => (
    <div key={label} style={{ background: warn ? "#FDF3E1" : C.canvas, borderRadius: 8, padding: "8px 12px", minWidth: 110 }}>
      <div style={{ ...body, fontSize: 18, fontWeight: 700, color: C.ink }}>{value}</div>
      <div style={{ ...body, fontSize: 11, color: C.muted }}>{label}</div>
    </div>
  );
  const td = { padding: "6px 8px", borderBottom: `1px solid ${C.line}` };

  return (
    <div>
      <div style={box}>
        <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Import the parts catalog from an Excel sheet</div>
        <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 12 }}>
          One row = one part, on the sheet "Part types" of Leap_Parts_Catalog.xlsx, with its names in English, Arabic and Chinese, its allowed positions, and its packed size and weight. A main category is one word, a sub-category 1 to 3 words, a part name 1 to 5 words.
          Categories are created if missing; nothing that exists is renamed or deleted. New items get a "photo coming soon" placeholder until a real photo is added.
        </div>
        <button onClick={handleTemplate} style={button(false, false)}><Download size={14} /> Download the template (.xlsx)</button>
      </div>

      <div style={box}>
        <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Optional: start clean (remove the old catalog first)</div>
        <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 10 }}>
          Removes the categories and parts that were made by hand before the parts catalog, so the imported catalog stands alone. It only removes what no product uses, and never anything an import created.
          Nothing is removed until you check the list and type the confirmation.
        </div>
        {!clean.open && !clean.result && <button onClick={() => loadCleanup(false)} style={button(false, false)}>Check what the old catalog contains</button>}
        {clean.open && clean.preview && !clean.result && (
          <div>
            {clean.busy ? <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 10 }}>Checking…</div> : (
            <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {tile(clean.preview.counts.categories, "old categories to remove")}
              {tile(clean.preview.counts.parts, "old parts to remove")}
              {clean.alsoProducts && tile(clean.preview.counts.products, "test products to remove", clean.preview.counts.products > 0)}
              {tile(clean.preview.counts.categoriesKept, "old categories that stay", clean.preview.counts.categoriesKept > 0)}
            </div>
            {clean.preview.hasImports && <div style={{ ...body, fontSize: 12.5, color: "#8A5A12", background: "#FDF3E1", borderRadius: 8, padding: 10, marginBottom: 8 }}>A catalog import already exists. Categories or parts you added by hand since then, without a catalog code, are counted as old too.</div>}
            {clean.preview.removed.categories.length > 0 && <div style={{ ...body, fontSize: 12.5, color: C.ink, marginBottom: 6 }}>Categories that will be removed: {clean.preview.removed.categories.map((c) => c.name).join(", ")}</div>}
            {clean.preview.kept.categories.map((c) => <div key={c.id} style={{ ...body, fontSize: 12.5, color: "#8A5A12", marginBottom: 4 }}>Stays: "{c.name}": {c.reason}</div>)}
            {clean.preview.kept.products.map((p) => <div key={p.id} style={{ ...body, fontSize: 12.5, color: "#8A5A12", marginBottom: 4 }}>Stays: product "{p.name}": {p.reason}</div>)}
            </>
            )}
            <label style={{ ...body, fontSize: 12.5, color: C.ink, display: "flex", gap: 6, alignItems: "center", margin: "10px 0" }}>
              <input type="checkbox" checked={clean.alsoProducts} onChange={(e) => loadCleanup(e.target.checked)} disabled={clean.busy} /> Also delete the test products that use the old catalog (a product that has been in an order is never deleted)
            </label>
            {clean.preview.counts.categories + clean.preview.counts.parts + clean.preview.counts.products === 0 ? <div style={{ ...body, fontSize: 12.5, color: C.muted }}>There is nothing old to remove.</div> : (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input aria-label="Confirmation" placeholder="Type REMOVE OLD" value={clean.confirm} onChange={(e) => setClean((c) => ({ ...c, confirm: e.target.value }))} style={{ ...body, fontSize: 13, padding: "7px 10px", border: `1px solid ${C.line}`, borderRadius: 8, width: 180 }} />
                <button disabled={clean.confirm !== "REMOVE OLD" || clean.busy} onClick={runCleanup} style={button(true, clean.confirm !== "REMOVE OLD" || clean.busy)}>{clean.busy ? "Working…" : "Remove the old catalog"}</button>
                <button onClick={() => setClean({ open: false, alsoProducts: false, preview: null, confirm: "", busy: false, result: null })} style={button(false, false)}>Cancel</button>
              </div>
            )}
          </div>
        )}
        {clean.result && (
          <div role="status">
            <div style={{ ...body, fontSize: 12.5, color: "#16794F", fontWeight: 700, marginBottom: 6 }}>Old catalog removed: {plural(clean.result.counts.categories, "category", "categories")}, {plural(clean.result.counts.parts, "part", "parts")}{clean.result.counts.products ? `, ${plural(clean.result.counts.products, "product", "products")}` : ""}.</div>
            {clean.result.kept.categories.length > 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 6 }}>{plural(clean.result.kept.categories.length, "old category stays", "old categories stay")} because products still use {clean.result.kept.categories.length === 1 ? "it" : "them"}.</div>}
            <button onClick={downloadRemoved} style={button(false, false)}><Download size={14} /> Download the list of what was removed (.xlsx)</button>
          </div>
        )}
      </div>

      {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, background: "#FBE7E5", borderRadius: 8, padding: 10, marginBottom: 14 }}>{error}</div>}

      {phase !== "done" && (
        <div style={box}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ ...button(false, phase === "checking" || phase === "importing") }}>
              <FileSpreadsheet size={14} /> {file ? "Choose another file" : "Choose the Excel file"}
              <input type="file" aria-label="Excel file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={phase === "checking" || phase === "importing"}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(null); setError(null); setPhase("idle"); } }} style={{ display: "none" }} />
            </label>
            {file && <span style={{ ...body, fontSize: 12.5, color: C.ink }}>{file.name} <span style={{ color: C.muted }}>· {sizeText(file.size)}</span></span>}
            <button disabled={!file || phase === "checking" || phase === "importing"} onClick={() => runCheck(file, mode)} style={button(true, !file || phase === "checking" || phase === "importing")}>
              <Check size={14} /> {phase === "checking" ? "Checking…" : "Check file"}
            </button>
          </div>
          <div role="radiogroup" aria-label="Rows that already exist" style={{ ...body, fontSize: 12.5, color: C.ink, marginTop: 12, display: "flex", gap: 18, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="radio" name="catalog-import-mode" checked={mode === "skip"} onChange={() => handleMode("skip")} /> Skip rows that already exist: only fill their empty fields (recommended)</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="radio" name="catalog-import-mode" checked={mode === "update"} onChange={() => handleMode("update")} /> Update rows that already exist</label>
          </div>
        </div>
      )}

      {preview && (phase === "checked" || phase === "importing") && s && (
        <div style={box}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {tile(s.rows, "rows read")}
            {tile(s.newCategories, "new categories")}
            {tile(s.newParts, "new parts")}
            {tile(s.existingCategories + s.existingParts, "already exist")}
            {tile(s.updatedCategories + s.updatedParts, mode === "update" ? "to update" : "to fill")}
            {tile(s.placeholdersUsed, "use the photo placeholder", s.placeholdersUsed > 0)}
            {tile(s.estimatedParts, "sizes are estimates", s.estimatedParts > 0)}
            {mode === "update" && tile(s.productsAffected, "products' shipping changes", s.productsAffected > 0)}
          </div>
          {s.rowsWithErrors > 0 && <div role="alert" style={{ ...body, fontSize: 12.5, color: "#B42318", background: "#FBE7E5", borderRadius: 8, padding: 10, marginBottom: 8 }}>{plural(s.rowsWithErrors, "row has a problem", "rows have problems")}. Fix them in the file and check it again: nothing is imported while any row has a problem.</div>}
          {s.estimatedParts > 0 && <div style={{ ...body, fontSize: 12.5, color: "#8A5A12", background: "#FDF3E1", borderRadius: 8, padding: 10, marginBottom: 8 }}>Sizes and weights marked "Estimate" are planning defaults, saved as estimates. A product without a size of its own will use them for shipping until you review them (Edit details tab, or the health numbers below).</div>}
          {preview.nearDuplicates?.length > 0 && (
            <div style={{ ...body, fontSize: 12.5, color: C.ink, background: C.canvas, borderRadius: 8, padding: 10, marginBottom: 8 }}>
              Possible duplicates of existing categories (nothing is merged or renamed; review them after the import):
              {preview.nearDuplicates.map((d) => <div key={d.newName + d.existingId}>"{d.newName}" and the existing "{d.existingName}"</div>)}
            </div>
          )}
          {preview.nothingToImport && <div style={{ ...body, fontSize: 12.5, color: C.ink, background: C.canvas, borderRadius: 8, padding: 10, marginBottom: 8 }}>Nothing to import: every row already exists{mode === "skip" ? ' (choose "Update rows that already exist" to refresh them)' : ""}.</div>}
          {preview.notes.map((n, i) => <div key={i} style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 4 }}>{n}</div>)}

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0 8px", flexWrap: "wrap" }}>
            <label style={{ ...body, fontSize: 12.5, color: C.ink, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={problemsOnly} onChange={(e) => { setProblemsOnly(e.target.checked); setShowAll(false); }} /> Show only rows with problems or warnings</label>
            <span style={{ ...body, fontSize: 12, color: C.muted }}>{shownRows.length} of {preview.rows.length} rows</span>
            <button onClick={handleReport} style={{ ...button(false, false), marginLeft: "auto" }}><Download size={14} /> Download report (.xlsx)</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", ...body, fontSize: 12 }}>
              <thead><tr>{["Row", "Category", "Part", "Positions", "Size and weight", "Result"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${C.line}`, color: C.muted, fontWeight: 700 }}>{h}</th>)}</tr></thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.rowNumber} data-status={r.status}>
                    <td style={td}>{r.rowNumber}</td><td style={td}>{r.category}</td><td style={td}>{r.part}</td><td style={td}>{r.positions}</td>
                    <td style={td}>{dims(r.size)}{r.sizeBasis === "estimate" ? <span style={{ marginLeft: 6, fontSize: 10.5, color: "#8A5A12" }}>estimate</span> : null}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: STATUS[r.status].color, background: STATUS[r.status].bg, borderRadius: 999, padding: "2px 8px" }}>{STATUS[r.status].label}</span>
                      {r.messages.map((m, i) => <div key={i} style={{ fontSize: 11.5, color: LEVEL_COLOR[m.level], marginTop: 2 }}>{m.text}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showAll && shownRows.length > SHOWN_AT_FIRST && <button onClick={() => setShowAll(true)} style={{ ...button(false, false), marginTop: 8 }}>Show all {shownRows.length} rows</button>}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
            <button disabled={!preview.ready || phase === "importing"} onClick={handleImport} style={button(true, !preview.ready || phase === "importing")}>
              {phase === "importing" ? "Importing…" : `Import ${plural(s.newCategories, "category", "categories")} and ${plural(s.newParts, "part", "parts")}`}
            </button>
            <span style={{ ...body, fontSize: 12, color: C.muted }}>Nothing is saved until you press Import. Everything is saved together, or nothing.</span>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div style={{ ...box, borderColor: "#16794F" }}>
          <div style={{ ...body, fontSize: 14, fontWeight: 700, color: "#16794F", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><Check size={16} /> Import finished</div>
          <div style={{ ...body, fontSize: 12.5, color: C.ink, lineHeight: 1.6 }}>
            {plural(result.summary.newCategories, "category", "categories")} and {plural(result.summary.newParts, "part", "parts")} added
            {result.summary.updatedCategories + result.summary.updatedParts > 0 ? `; ${plural(result.summary.updatedCategories + result.summary.updatedParts, "existing row", "existing rows")} filled or updated` : ""}.
            {result.summary.placeholdersUsed > 0 && <div style={{ color: "#8A5A12", display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}><AlertTriangle size={14} /> {plural(result.summary.placeholdersUsed, "item uses", "items use")} the photo placeholder: add the real photos on this page when you have them.</div>}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button onClick={reset} style={button(false, false)}>Check another file</button>
          </div>
        </div>
      )}

      {undone && <div role="status" style={{ ...body, fontSize: 12.5, color: C.ink, background: "#E6F5EE", borderRadius: 8, padding: 10, marginBottom: 14 }}>
        Import undone: {plural(undone.partsRemoved, "part", "parts")} and {plural(undone.categoriesRemoved, "category", "categories")} removed.
        {undone.partsKeptBecauseInUse + undone.categoriesKeptBecauseInUse > 0 ? ` ${undone.partsKeptBecauseInUse} part(s) and ${undone.categoriesKeptBecauseInUse} category(ies) stay because products use them.` : ""} {undone.note}</div>}

      {health && (
        <div style={box}>
          <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Catalog health</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {tile(health.categories.total, "categories")}
            {tile(health.parts.total, "parts")}
            {tile(health.categories.withoutRealPhoto + health.parts.withoutRealPhoto, "still without a real photo", health.categories.withoutRealPhoto + health.parts.withoutRealPhoto > 0)}
            {tile(health.parts.onEstimatedSize, "parts on an estimated size", health.parts.onEstimatedSize > 0)}
            {tile(health.productsPricedOnEstimates, "products shipped on estimates", health.productsPricedOnEstimates > 0)}
          </div>
        </div>
      )}

      {batches.length > 0 && (
        <div style={box}>
          <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Imports so far</div>
          {batches.map((b) => (
            <div key={b.id} style={{ ...body, fontSize: 12.5, color: C.ink, display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600 }}>{b.fileName}</span>
              <span style={{ color: C.muted }}>{new Date(b.createdAt).toLocaleString()} · {plural(b.categoriesAdded, "category", "categories")}, {plural(b.partsAdded, "part", "parts")} added</span>
              {b.undoneAt ? <span style={{ color: C.muted, marginLeft: "auto" }}>Undone</span> : undoing === b.id ? (
                <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: "#B42318" }}>Remove what this import created? Parts that products use stay.</span>
                  <button onClick={() => handleUndo(b.id)} style={button(true, false)}>Yes, undo it</button>
                  <button onClick={() => setUndoing(null)} style={button(false, false)}>Cancel</button>
                </span>
              ) : <button onClick={() => setUndoing(b.id)} style={{ ...button(false, false), marginLeft: "auto" }}><Undo2 size={14} /> Undo</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
