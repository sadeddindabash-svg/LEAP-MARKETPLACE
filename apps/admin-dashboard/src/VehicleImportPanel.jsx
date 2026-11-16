import React, { useState } from "react";
import { Download, FileSpreadsheet, Check, AlertTriangle, Upload } from "lucide-react";
import { C, body, disp, mono } from "./theme";
import { SessionExpiredError, getStoredToken, previewVehicleImport, commitVehicleImport, downloadVehicleImportTemplate } from "./auth";
import { exportToExcel } from "./exportToExcel";
import UnusedPicturesCard from "./UnusedPicturesCard";

// "Import from Excel" on the Vehicle Data page: choose a file in the template's layout, CHECK it (nothing is saved), read what will happen, then IMPORT (all or nothing).
// patch-vehicle-excel-redesign: the three steps (template, file, import) as a step bar; the file is chosen in a drop area (drag the file in, or click);
// "rows that already exist" as two option cards; the check's numbers as tiles; the rows in a table with a fixed header; the Import button in a bar under it.
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
  const [dragOver, setDragOver] = useState(false);
  const [templateDone, setTemplateDone] = useState(false);

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
    try { downloadBlob(await downloadVehicleImportTemplate(getStoredToken()), "Leap_Vehicle_Import_Template.xlsx"); setTemplateDone(true); } catch (err) { fail(err); }
  };
  const handleMode = (next) => { setMode(next); if (file && phase === "checked") runCheck(file, next); };
  const handlePictures = (next) => { setReplacePictures(next); if (file && phase === "checked") runCheck(file, mode, next); };
  const handleImport = async () => {
    setPhase("importing"); setError(null);
    try { const done = await commitVehicleImport(getStoredToken(), file, mode, replacePictures); setResult(done); setPreview(null); setPhase("done"); }
    catch (err) { setPhase("checked"); fail(err); }
  };
  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null); setPhase("idle"); setMode("skip"); setReplacePictures(true); };
  const pickFile = (f) => { if (f) { setFile(f); setPreview(null); setError(null); setPhase("idle"); } };
  const handleReport = () => exportToExcel({
    sheetName: "Import check", filename: `Vehicle_import_report_${preview.fileName.replace(/\.xlsx$/i, "")}.xlsx`,
    columns: [{ header: "Row", key: "row", width: 8 }, { header: "Brand", key: "brand", width: 16 }, { header: "Model", key: "model", width: 14 }, { header: "Year", key: "year", width: 8 }, { header: "Version", key: "version", width: 34 }, { header: "Seats", key: "seats", width: 8 }, { header: "Picture", key: "picture", width: 12 }, { header: "Result", key: "result", width: 16 }, { header: "Messages", key: "messages", width: 80 }],
    rows: preview.rows.map((r) => ({ row: r.rowNumber, brand: r.brand, model: r.model, year: r.year, version: r.version, seats: r.seats, picture: r.picture ? `${r.picture.width}x${r.picture.height}` : "none", result: STATUS[r.status].label, messages: r.messages.map((m) => m.text).join(" | ") })),
  });

  const busy = phase === "checking" || phase === "importing";
  const card = { border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, background: "#fff", boxShadow: "0 1px 2px rgba(11,49,70,0.05)", marginBottom: 16 };
  const button = (primary, disabled) => ({ ...body, display: "inline-flex", alignItems: "center", gap: 7, height: 40, boxSizing: "border-box", padding: "0 16px", borderRadius: 10, border: primary ? `1px solid ${disabled ? "#D1D5DB" : C.signalDark}` : `1px solid ${C.line}`, background: disabled ? "#D1D5DB" : primary ? C.signal : "#fff", color: primary ? C.onSignal : C.ink, fontSize: 13, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap" });
  const note = (bg, color) => ({ ...body, fontSize: 12.5, color, background: bg, borderRadius: 10, padding: "10px 12px", marginBottom: 8, lineHeight: 1.5 });
  const s = preview?.summary;
  const toImport = s ? s.newVersions + s.updatedVersions : 0;
  const shownRows = preview ? preview.rows.filter((r) => !problemsOnly || r.status === "error" || r.messages.some((m) => m.level === "warning")) : [];
  const visibleRows = showAll ? shownRows : shownRows.slice(0, SHOWN_AT_FIRST);
  // a number tile: green for what will be added, grey for what already exists, amber for what needs a look later
  const tile = (value, label, tone = "plain") => {
    const t = { plain: [C.surfaceHigh, C.ink, C.line], add: ["#EEF8F3", C.gaugeInk, "#CDEBDD"], warn: [C.amberBg, C.amberInk, "#F1D9A8"], info: ["#EEF3FC", C.torqueInk, "#D3E0F7"] }[tone];
    return (
      <div key={label} style={{ background: t[0], border: `1px solid ${t[2]}`, borderRadius: 12, padding: "10px 12px" }}>
        <div style={{ ...mono, fontSize: 20, fontWeight: 800, color: t[1] }}>{value}</div>
        <div style={{ ...body, fontSize: 11.5, fontWeight: 600, color: C.muted }}>{label}</div>
      </div>
    );
  };
  const stepNow = phase === "done" ? 3 : phase === "checked" || phase === "importing" ? 2 : file ? 1 : templateDone ? 1 : 0;
  const steps = [["Get the template", "the columns the file must have"], ["Choose and check the file", "nothing is saved yet"], ["Import", "everything together, or nothing"]];
  const optionCard = (value, title, text) => (
    <label key={value} style={{ ...body, flex: "1 1 240px", display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 13px", borderRadius: 12, cursor: busy ? "default" : "pointer",
      border: `1.5px solid ${mode === value ? C.signal : C.line}`, background: mode === value ? C.goldTint : "#fff" }}>
      <input type="radio" name="import-mode" checked={mode === value} onChange={() => handleMode(value)} disabled={busy} style={{ marginTop: 2, accentColor: C.navy }} />
      <span>
        <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: C.ink }}>{title}</span>
        <span style={{ display: "block", fontSize: 11.5, color: C.muted, marginTop: 2 }}>{text}</span>
      </span>
    </label>
  );

  return (
    <div data-testid="vehicle-import">
      {/* the three steps */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 2px rgba(11,49,70,0.05)" }}>
        {steps.map(([title, sub], i) => {
          const state = i < stepNow ? "done" : i === stepNow ? "now" : "next";
          return (
            <div key={title} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderLeft: i ? `1px solid ${C.line}` : "none", background: state === "now" ? C.goldTint : "#fff", boxShadow: state === "now" ? `inset 0 -3px 0 ${C.signal}` : "none" }}>
              <span style={{ ...body, width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800,
                background: state === "done" ? C.navy : state === "now" ? C.signal : C.canvas, color: state === "done" ? "#fff" : state === "now" ? C.onSignal : C.muted, border: state === "next" ? `1px solid ${C.lineStrong}` : "none" }}>
                {state === "done" ? <Check size={14} /> : i + 1}
              </span>
              <span style={{ ...body, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: state === "next" ? C.muted : C.ink }}>{title}</span>
                <span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{sub}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* step 1: what the file is, and the template */}
      <div style={{ ...card, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "#E7F4EC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FileSpreadsheet size={22} color="#1D6F42" /></div>
        <div style={{ flex: "1 1 380px", minWidth: 0 }}>
          <div style={{ ...disp, fontSize: 15.5, fontWeight: 800, color: C.ink }}>Import vehicles from an Excel sheet</div>
          <div style={{ ...body, fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
            One row = one version of a vehicle in one year, with its names in English, Arabic and Chinese, its seats, and its picture. The brand must already exist (add it in the Brands tab, with its photo); models and years are created for you. The file is checked first and nothing is saved until you press Import.
          </div>
        </div>
        <button onClick={handleTemplate} style={button(false, false)}><Download size={15} /> Download the template (.xlsx)</button>
      </div>

      {error && <div role="alert" style={{ ...note(C.redBg, C.redInk), marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}</div>}

      {/* step 2: the file and the options */}
      {phase !== "done" && (
        <div style={card}>
          <div style={{ ...disp, fontSize: 14.5, fontWeight: 800, color: C.ink, marginBottom: 10 }}>Choose the file</div>
          <label
            onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) pickFile(e.dataTransfer.files?.[0]); }}
            style={{ ...body, display: "flex", alignItems: "center", gap: 14, padding: file ? "14px 16px" : "26px 16px", justifyContent: file ? "flex-start" : "center", flexDirection: file ? "row" : "column", textAlign: "center",
              border: `2px dashed ${dragOver ? C.signal : file ? "#9FD2B8" : C.lineStrong}`, borderRadius: 14, background: dragOver ? C.goldTint : file ? "#F3FAF6" : C.surfaceHigh, cursor: busy ? "default" : "pointer" }}>
            {file ? (
              <>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#E7F4EC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FileSpreadsheet size={20} color="#1D6F42" /></div>
                <span style={{ textAlign: "left", minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name} <span style={{ color: C.muted, fontWeight: 600 }}>· {sizeText(file.size)}</span></span>
                  <span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{phase === "checked" ? "Checked. Change an option below and it is checked again." : "Press Check file to read it (nothing is saved)."}</span>
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.torque, flexShrink: 0 }}>Choose another file</span>
              </>
            ) : (
              <>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#fff", border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Upload size={20} color={C.navy} /></div>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>Choose the Excel file</span>
                <span style={{ fontSize: 12, color: C.muted }}>or drag it here · .xlsx in the template's layout</span>
              </>
            )}
            <input type="file" aria-label="Excel file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy}
              onChange={(e) => pickFile(e.target.files?.[0])} style={{ display: "none" }} />
          </label>

          <div style={{ ...body, fontSize: 11.5, fontWeight: 800, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", margin: "16px 0 8px" }}>Rows that already exist</div>
          <div role="radiogroup" aria-label="Rows that already exist" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {optionCard("skip", "Skip rows that already exist (recommended)", "Only the new versions are added; what is already there is left as it is.")}
            {optionCard("update", "Update rows that already exist", "The names, engine and seats of versions already there are replaced with the file's.")}
          </div>
          <label style={{ ...body, fontSize: 12.5, color: C.ink, marginTop: 12, display: "flex", gap: 8, alignItems: "center", padding: "9px 12px", borderRadius: 10, background: C.surfaceHigh, border: `1px solid ${C.line}`, opacity: mode === "update" ? 0.75 : 1 }}>
            <input type="checkbox" checked={mode === "update" ? true : replacePictures} disabled={mode === "update"} onChange={(e) => handlePictures(e.target.checked)} style={{ accentColor: C.navy }} /> Use the pictures in this file for vehicles that already exist (the old pictures are removed){mode === "update" ? " - always on when updating" : ""}
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button disabled={!file || busy} onClick={() => runCheck(file, mode)} style={button(true, !file || busy)}>
              <Check size={15} /> {phase === "checking" ? "Checking…" : "Check file"}
            </button>
          </div>
        </div>
      )}

      {/* step 3: what the check found, and Import */}
      {preview && (phase === "checked" || phase === "importing") && s && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 18 }}>
            <div style={{ ...disp, fontSize: 14.5, fontWeight: 800, color: C.ink, marginBottom: 12 }}>What the check found</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
              {tile(s.rows, "rows read")}
              {tile(s.newBrands || 0, "new brands", (s.newBrands || 0) > 0 ? "add" : "plain")}
              {(s.brandNamesUpdated || s.brandLogosSaved) ? tile((s.brandNamesUpdated || 0) + (s.brandLogosSaved || 0), "brand updates", "info") : null}
              {s.newBrandsWithoutLogo > 0 && tile(s.newBrandsWithoutLogo, 'brands saved as "No logo yet"', "warn")}
              {tile(s.newModels, "new models", s.newModels > 0 ? "add" : "plain")}
              {tile(s.newYears, "new years", s.newYears > 0 ? "add" : "plain")}
              {tile(s.newVersions, "new versions", s.newVersions > 0 ? "add" : "plain")}
              {tile(s.existingVersions, "already exist")}
              {mode === "update" && tile(s.updatedVersions, "to update", "info")}
              {tile(s.picturesFound, "pictures found")}
              {s.picturesReplaced > 0 && tile(s.picturesReplaced, "pictures replace old ones", "info")}
              {tile(s.newWithoutPicture, 'saved as "No photo yet"', s.newWithoutPicture > 0 ? "warn" : "plain")}
            </div>

            {s.missingBrands.length > 0 && (
              <div role="alert" style={note(C.redBg, "#B42318")}>
                {s.missingBrands.map((b) => `Brand "${b}"`).join(", ")} {s.missingBrands.length === 1 ? "does" : "do"} not exist yet. Add {s.missingBrands.length === 1 ? "it" : "them"} first in the Brands tab (with the photo), then check the file again. <b>This blocks the import.</b>
                {onGoToBrands && <button onClick={onGoToBrands} style={{ ...body, marginLeft: 8, border: "none", background: "none", color: "#B42318", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>Go to Brands</button>}
              </div>
            )}
            {s.rowsWithErrors > 0 && s.missingBrands.length === 0 && (
              <div role="alert" style={note(C.redBg, "#B42318")}>{plural(s.rowsWithErrors, "row has a problem", "rows have problems")}. Fix the file and check it again. <b>This blocks the import.</b></div>
            )}
            {s.newWithoutPicture > 0 && <div style={note(C.amberBg, "#8A5A12")}>{plural(s.newWithoutPicture, "new version has", "new versions have")} no picture. {s.newWithoutPicture === 1 ? "It" : "They"} will be saved marked "No photo yet": add the photo later in Vehicle Data (brand, model, year, Versions).</div>}
            {preview.nothingToImport && <div style={note(C.surfaceHigh, C.ink)}>Nothing to import: every row already exists{mode === "skip" ? ' (choose "Update rows that already exist" to bring them up to date)' : " and nothing changed"}.</div>}
            {preview.notes.map((n, i) => <div key={i} style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 4 }}>{n}</div>)}
            {preview.issues.map((n, i) => <div key={`i${i}`} style={{ ...body, fontSize: 12, color: LEVEL_COLOR[n.level] || C.muted, marginBottom: 4 }}>{n.text}</div>)}

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 10px", flexWrap: "wrap" }}>
              <label style={{ ...body, fontSize: 12.5, fontWeight: 700, color: C.ink, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={problemsOnly} onChange={(e) => { setProblemsOnly(e.target.checked); setShowAll(false); }} style={{ accentColor: C.navy }} /> Problems and warnings only</label>
              <span style={{ ...body, fontSize: 12, color: C.muted }}>{shownRows.length} of {preview.rows.length} rows</span>
              <button onClick={handleReport} style={{ ...button(false, false), height: 34, marginLeft: "auto" }}><Download size={14} /> Download report (.xlsx)</button>
            </div>
            <div style={{ maxHeight: 460, overflow: "auto", border: `1px solid ${C.line}`, borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, ...body, fontSize: 12.5 }}>
                <thead><tr>{["Row", "Model", "Year", "Version", "Seats", "Picture", "Result"].map((h) => <th key={h} style={{ position: "sticky", top: 0, zIndex: 1, textAlign: "left", padding: "9px 10px", background: C.surfaceHigh, borderBottom: `1px solid ${C.line}`, color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.rowNumber} data-status={r.status} style={{ background: r.status === "error" ? "#FFF7F6" : "#fff" }}>
                      <td style={{ ...mono, padding: "8px 10px", borderBottom: `1px solid ${C.line}`, color: C.muted }}>{r.rowNumber}</td>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${C.line}`, fontWeight: 700 }}>{r.model}</td>
                      <td style={{ ...mono, padding: "8px 10px", borderBottom: `1px solid ${C.line}` }}>{r.year}</td>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${C.line}` }}>{r.version}</td>
                      <td style={{ ...mono, padding: "8px 10px", borderBottom: `1px solid ${C.line}` }}>{r.seats}</td>
                      <td style={{ ...mono, padding: "8px 10px", borderBottom: `1px solid ${C.line}`, color: r.picture ? C.ink : C.amberInk }}>{r.picture ? `${r.picture.width}×${r.picture.height}` : "none"}</td>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${C.line}` }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: STATUS[r.status].color, background: STATUS[r.status].bg, borderRadius: 999, padding: "2px 9px" }}>{STATUS[r.status].label}</span>
                        {r.messages.map((m, i) => <div key={i} style={{ fontSize: 11.5, color: LEVEL_COLOR[m.level], marginTop: 3 }}>{m.text}</div>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showAll && shownRows.length > SHOWN_AT_FIRST && <button onClick={() => setShowAll(true)} style={{ ...button(false, false), height: 34, marginTop: 10 }}>Show all {shownRows.length} rows</button>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: `linear-gradient(120deg, ${C.navyDeep}, ${C.navy} 60%, ${C.navySoft} 140%)`, flexWrap: "wrap" }}>
            <span style={{ ...body, fontSize: 12.5, color: C.onNavyMuted, flex: "1 1 260px" }}>Nothing is saved until you press Import. Everything is saved together, or nothing.</span>
            <button disabled={!preview.ready || phase === "importing"} onClick={handleImport} style={{ ...button(true, !preview.ready || phase === "importing"), height: 42, padding: "0 22px", fontSize: 14 }}>
              {phase === "importing" ? "Importing…" : `Import ${plural(toImport, "vehicle", "vehicles")}`}
            </button>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div style={{ ...card, border: "1px solid #9FD2B8", background: "#F3FAF6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.gauge, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check size={20} color="#fff" /></span>
            <div style={{ ...disp, fontSize: 16, fontWeight: 800, color: "#16794F" }}>Import finished</div>
          </div>
          <div style={{ ...body, fontSize: 13, color: C.ink, lineHeight: 1.6 }}>
            {result.summary.newBrands > 0 ? `${plural(result.summary.newBrands, "brand", "brands")} created; ` : ""}{plural(result.summary.newVersions, "version", "versions")} added{result.summary.updatedVersions > 0 ? `, ${plural(result.summary.updatedVersions, "version", "versions")} updated` : ""}; {plural(result.summary.newModels, "model", "models")} and {plural(result.summary.newYears, "year", "years")} created; {plural(result.summary.picturesToSave, "picture", "pictures")} saved; {plural(result.summary.existingVersions, "row", "rows")} already existed.
            {result.summary.newWithoutPicture > 0 && <div style={{ color: "#8A5A12", display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}><AlertTriangle size={14} /> {plural(result.summary.newWithoutPicture, "version is", "versions are")} marked "No photo yet" (and the new years have no photo): add them in Vehicle Data (brand, model, year, Versions).</div>}
          </div>
          {result.oldPicturesRemoved > 0 && <div style={{ ...body, fontSize: 12.5, color: C.ink, marginTop: 6 }}>{plural(result.oldPicturesRemoved, "old picture was", "old pictures were")} removed from the server.</div>}
          <button onClick={reset} style={{ ...button(false, false), marginTop: 14 }}>Check another file</button>
        </div>
      )}
      <UnusedPicturesCard onSessionExpired={onSessionExpired} />
    </div>
  );
}
