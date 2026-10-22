import React, { useState } from "react";
import { Download, FileSpreadsheet, Check, AlertTriangle } from "lucide-react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken, previewVehicleImport, commitVehicleImport, downloadVehicleImportTemplate } from "./auth";
import { exportToExcel } from "./exportToExcel";
import UnusedPicturesCard from "./UnusedPicturesCard";

// "Import from Excel" on the Vehicle Data page: choose a file in the template's layout, CHECK it (nothing is saved), read what will happen, then IMPORT (all or nothing).
const STATUS = {
  new: { label: "New", color: "#16794F", bg: "#E6F5EE" },
  update: { label: "Update", color: "#1D4E89", bg: "#E5EEF9" },
  exists: { label: "Already exists", color: "#4B5563", bg: "#EEF0F3" },
  error: { label: "Problem", color: "#B42318", bg: "#FBE7E5" },
};
const LEVEL_COLOR = { error: "#B42318", warning: "#8A5A12", info: "#4B5563" };
const SHOWN_AT_FIRST = 100;
const sizeText = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function VehicleImportPanel({ onSessionExpired, onGoToBrands }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("skip");
  const [replacePictures, setReplacePictures] = useState(true);      // "use the pictures in this file for vehicles that already exist" (the old pictures are removed)
  const [phase, setPhase] = useState("idle");              // idle | checking | checked | importing | done
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fail = (err) => {
    if (err instanceof SessionExpiredError) { onSessionExpired(); return; }
    setError(err.message);
    if (err.payload && err.payload.rows) setPreview(err.payload);       // a refusal that explains itself: show what is wrong
  };
  const runCheck = async (theFile, theMode, thePictures = replacePictures) => {
    setPhase("checking"); setError(null); setResult(null); setShowAll(false);
    try { setPreview(await previewVehicleImport(getStoredToken(), theFile, theMode, thePictures)); setPhase("checked"); }
    catch (err) { setPreview(null); setPhase("idle"); fail(err); }
  };
  const handleTemplate = async () => {
    setError(null);
    try { downloadBlob(await downloadVehicleImportTemplate(getStoredToken()), "Leap_Vehicle_Import_Template.xlsx"); } catch (err) { fail(err); }
  };
  const handleMode = (next) => { setMode(next); if (file && phase === "checked") runCheck(file, next); };
  const handlePictures = (next) => { setReplacePictures(next); if (file && phase === "checked") runCheck(file, mode, next); };
  const handleImport = async () => {
    setPhase("importing"); setError(null);
    try { const done = await commitVehicleImport(getStoredToken(), file, mode, replacePictures); setResult(done); setPreview(null); setPhase("done"); }
    catch (err) { setPhase("checked"); fail(err); }
  };
  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null); setPhase("idle"); setMode("skip"); setReplacePictures(true); };
  const handleReport = () => exportToExcel({
    sheetName: "Import check", filename: `Vehicle_import_report_${preview.fileName.replace(/\.xlsx$/i, "")}.xlsx`,
    columns: [{ header: "Row", key: "row", width: 8 }, { header: "Brand", key: "brand", width: 16 }, { header: "Model", key: "model", width: 14 }, { header: "Year", key: "year", width: 8 }, { header: "Version", key: "version", width: 34 }, { header: "Seats", key: "seats", width: 8 }, { header: "Picture", key: "picture", width: 12 }, { header: "Result", key: "result", width: 16 }, { header: "Messages", key: "messages", width: 80 }],
    rows: preview.rows.map((r) => ({ row: r.rowNumber, brand: r.brand, model: r.model, year: r.year, version: r.version, seats: r.seats, picture: r.picture ? `${r.picture.width}x${r.picture.height}` : "none", result: STATUS[r.status].label, messages: r.messages.map((m) => m.text).join(" | ") })),
  });

  const box = { border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, background: C.card, marginBottom: 14 };
  const button = (primary, disabled) => ({ ...body, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: primary ? "none" : `1px solid ${C.line}`, background: disabled ? "#D1D5DB" : primary ? C.signal : C.card, color: primary ? C.onSignal : C.ink, fontSize: 12.5, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer" });
  const s = preview?.summary;
  const toImport = s ? s.newVersions + s.updatedVersions : 0;
  const shownRows = preview ? preview.rows.filter((r) => !problemsOnly || r.status === "error" || r.messages.some((m) => m.level === "warning")) : [];
  const visibleRows = showAll ? shownRows : shownRows.slice(0, SHOWN_AT_FIRST);
  const tile = (value, label, warn) => (
    <div key={label} style={{ background: warn ? "#FDF3E1" : C.canvas, borderRadius: 8, padding: "8px 12px", minWidth: 110 }}>
      <div style={{ ...body, fontSize: 18, fontWeight: 700, color: C.ink }}>{value}</div>
      <div style={{ ...body, fontSize: 11, color: C.muted }}>{label}</div>
    </div>
  );

  return (
    <div>
      <div style={box}>
        <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Import vehicles from an Excel sheet</div>
        <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 12 }}>
          One row = one version of a vehicle in one year, with its names in English, Arabic and Chinese, its seats, and its picture. The brand must already exist (add it in the Brands tab, with its photo); models and years are created for you. The file is checked first and nothing is saved until you press Import.
        </div>
        <button onClick={handleTemplate} style={button(false, false)}><Download size={14} /> Download the template (.xlsx)</button>
      </div>

      {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, background: "#FBE7E5", borderRadius: 8, padding: 10, marginBottom: 14 }}>{error}</div>}

      {phase !== "done" && (
        <div style={box}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ ...button(false, phase === "checking" || phase === "importing"), }}>
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
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="radio" name="import-mode" checked={mode === "skip"} onChange={() => handleMode("skip")} /> Skip rows that already exist (recommended)</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="radio" name="import-mode" checked={mode === "update"} onChange={() => handleMode("update")} /> Update rows that already exist</label>
          </div>
          <label style={{ ...body, fontSize: 12.5, color: C.ink, marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={mode === "update" ? true : replacePictures} disabled={mode === "update"} onChange={(e) => handlePictures(e.target.checked)} /> Use the pictures in this file for vehicles that already exist (the old pictures are removed){mode === "update" ? " - always on when updating" : ""}
          </label>
        </div>
      )}

      {preview && (phase === "checked" || phase === "importing") && s && (
        <div style={box}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {tile(s.rows, "rows read")}
            {tile(s.newModels, "new models")}
            {tile(s.newYears, "new years")}
            {tile(s.newVersions, "new versions")}
            {tile(s.existingVersions, "already exist")}
            {mode === "update" && tile(s.updatedVersions, "to update")}
            {tile(s.picturesFound, "pictures found")}
            {s.picturesReplaced > 0 && tile(s.picturesReplaced, "pictures replace old ones")}
            {tile(s.newWithoutPicture, 'saved as "No photo yet"', s.newWithoutPicture > 0)}
          </div>

          {s.missingBrands.length > 0 && (
            <div role="alert" style={{ ...body, fontSize: 12.5, color: "#B42318", background: "#FBE7E5", borderRadius: 8, padding: 10, marginBottom: 8 }}>
              {s.missingBrands.map((b) => `Brand "${b}"`).join(", ")} {s.missingBrands.length === 1 ? "does" : "do"} not exist yet. Add {s.missingBrands.length === 1 ? "it" : "them"} first in the Brands tab (with the photo), then check the file again. <b>This blocks the import.</b>
              {onGoToBrands && <button onClick={onGoToBrands} style={{ ...body, marginLeft: 8, border: "none", background: "none", color: "#B42318", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>Go to Brands</button>}
            </div>
          )}
          {s.rowsWithErrors > 0 && s.missingBrands.length === 0 && (
            <div role="alert" style={{ ...body, fontSize: 12.5, color: "#B42318", background: "#FBE7E5", borderRadius: 8, padding: 10, marginBottom: 8 }}>{plural(s.rowsWithErrors, "row has a problem", "rows have problems")}. Fix the file and check it again. <b>This blocks the import.</b></div>
          )}
          {s.newWithoutPicture > 0 && <div style={{ ...body, fontSize: 12.5, color: "#8A5A12", background: "#FDF3E1", borderRadius: 8, padding: 10, marginBottom: 8 }}>{plural(s.newWithoutPicture, "new version has", "new versions have")} no picture. {s.newWithoutPicture === 1 ? "It" : "They"} will be saved marked "No photo yet": add the photo later in Vehicle Data (brand, model, year, Versions).</div>}
          {preview.nothingToImport && <div style={{ ...body, fontSize: 12.5, color: C.ink, background: C.canvas, borderRadius: 8, padding: 10, marginBottom: 8 }}>Nothing to import: every row already exists{mode === "skip" ? ' (choose "Update rows that already exist" to bring them up to date)' : " and nothing changed"}.</div>}
          {preview.notes.map((n, i) => <div key={i} style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 4 }}>{n}</div>)}
          {preview.issues.map((n, i) => <div key={`i${i}`} style={{ ...body, fontSize: 12, color: LEVEL_COLOR[n.level] || C.muted, marginBottom: 4 }}>{n.text}</div>)}

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0 8px", flexWrap: "wrap" }}>
            <label style={{ ...body, fontSize: 12.5, color: C.ink, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={problemsOnly} onChange={(e) => { setProblemsOnly(e.target.checked); setShowAll(false); }} /> Problems and warnings only</label>
            <span style={{ ...body, fontSize: 12, color: C.muted }}>{shownRows.length} of {preview.rows.length} rows</span>
            <button onClick={handleReport} style={{ ...button(false, false), marginLeft: "auto" }}><Download size={14} /> Download report (.xlsx)</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", ...body, fontSize: 12 }}>
              <thead><tr>{["Row", "Model", "Year", "Version", "Seats", "Picture", "Result"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${C.line}`, color: C.muted, fontWeight: 700 }}>{h}</th>)}</tr></thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.rowNumber} data-status={r.status}>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{r.rowNumber}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{r.model}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{r.year}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{r.version}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{r.seats}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{r.picture ? `${r.picture.width}×${r.picture.height}` : "none"}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>
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
              {phase === "importing" ? "Importing…" : `Import ${plural(toImport, "vehicle", "vehicles")}`}
            </button>
            <span style={{ ...body, fontSize: 12, color: C.muted }}>Nothing is saved until you press Import. Everything is saved together, or nothing.</span>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div style={{ ...box, borderColor: "#16794F" }}>
          <div style={{ ...body, fontSize: 14, fontWeight: 700, color: "#16794F", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><Check size={16} /> Import finished</div>
          <div style={{ ...body, fontSize: 12.5, color: C.ink, lineHeight: 1.6 }}>
            {plural(result.summary.newVersions, "version", "versions")} added{result.summary.updatedVersions > 0 ? `, ${plural(result.summary.updatedVersions, "version", "versions")} updated` : ""}; {plural(result.summary.newModels, "model", "models")} and {plural(result.summary.newYears, "year", "years")} created; {plural(result.summary.picturesToSave, "picture", "pictures")} saved; {plural(result.summary.existingVersions, "row", "rows")} already existed.
            {result.summary.newWithoutPicture > 0 && <div style={{ color: "#8A5A12", display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}><AlertTriangle size={14} /> {plural(result.summary.newWithoutPicture, "version is", "versions are")} marked "No photo yet" (and the new years have no photo): add them in Vehicle Data (brand, model, year, Versions).</div>}
          </div>
          {result.oldPicturesRemoved > 0 && <div style={{ ...body, fontSize: 12.5, color: C.ink, marginTop: 6 }}>{plural(result.oldPicturesRemoved, "old picture was", "old pictures were")} removed from the server.</div>}
          <button onClick={reset} style={{ ...button(false, false), marginTop: 12 }}>Check another file</button>
        </div>
      )}
      <UnusedPicturesCard onSessionExpired={onSessionExpired} />
    </div>
  );
}
