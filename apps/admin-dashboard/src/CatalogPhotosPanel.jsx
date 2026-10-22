import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken } from "./auth";
import { fetchCoverage, fetchBatches, undoBatch, saveFallback, uploadPhotos, downloadShotList } from "./catalogPhotosApi";
import { classify, tally, inBatches, newBatchId, prepareImage, WILL_SAVE, PROBLEMS, LABELS, PHOTO_PX, MIN_SOURCE_PX } from "./photoPrep";

// Categories > Photos. Where the real pictures of the catalog (the sections and the parts) are managed:
//   1. what has a picture and what is still waiting, and a SHOT LIST to give whoever makes the pictures;
//   2. a bulk IMPORT: choose the pictures (named by code, e.g. BRK.jpg, BRK-001.jpg), check the preview, press Import. Nothing is saved before that, and an import can be undone;
//   3. an optional switch: show a product's own photo for a section or part that has none yet.
const card = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 16 };
const h2 = { ...body, fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 };
const hint = { ...body, fontSize: 12.5, color: C.muted, margin: "6px 0 12px", lineHeight: 1.5 };
const button = { ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: C.line, background: "#fff", color: C.ink };
const primary = { ...button, background: C.ink, color: "#fff", borderColor: C.ink };
const CHIP = { new: ["#16794F", "#E7F6EE"], replaces: ["#8A5A12", "#FDF3E1"], kept: [C.muted, "#EEF1F4"] };
const chipColors = (s) => CHIP[s] || ["#A32D2D", "#FCEBEB"];
const Bar = ({ done, total, label }) => <div role="progressbar" aria-label={label} aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} style={{ height: 8, borderRadius: 4, background: "#EEF1F4", overflow: "hidden" }}><div style={{ width: `${total ? Math.round((done / total) * 100) : 0}%`, height: "100%", background: C.ink }} /></div>;
const SERVER_PROBLEM = { unknown_code: "no such code", bad_name: "name is not a code", not_image: "not a picture", wrong_size: "wrong size", duplicate: "same code twice" };

export default function CatalogPhotosPanel({ onSessionExpired, prepare = prepareImage }) {
  const [cov, setCov] = useState(null); const [batches, setBatches] = useState([]); const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null); const [notice, setNotice] = useState(null);
  const [prepared, setPrepared] = useState(null); const [phase, setPhase] = useState("idle"); const [progress, setProgress] = useState(null); const [report, setReport] = useState(null);
  const [replace, setReplace] = useState(false); const [onlyProblems, setOnlyProblems] = useState(false); const [confirmUndo, setConfirmUndo] = useState(null); const [busy, setBusy] = useState(false);
  const urls = useRef([]);
  const expired = (err) => { if (err instanceof SessionExpiredError) { onSessionExpired?.(); return true; } return false; };
  const reload = async () => { const t = getStoredToken(); const [c, b] = await Promise.all([fetchCoverage(t), fetchBatches(t)]); setCov(c); setBatches(b.batches); };
  useEffect(() => { reload().catch((e) => { if (!expired(e)) setLoadError(e.message); }); return () => urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => (prepared && cov ? classify(prepared.map((p) => ({ file: p.file, width: p.width, height: p.height, error: p.error })), cov, replace).map((c, i) => ({ ...c, blob: prepared[i].blob, preview: prepared[i].preview })) : []), [prepared, cov, replace]);
  const counts = tally(items);
  const needed = cov ? cov.sections.filter((s) => !s.hasPhoto).length + [...new Set(cov.parts.filter((p) => !p.hasPhoto).map((p) => p.group))].length : 0;

  const reset = () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = []; setPrepared(null); setReport(null); setProgress(null); setPhase("idle"); setError(null); };
  const choose = async (event) => {
    const files = [...(event.target.files || [])]; event.target.value = ""; if (files.length === 0) return;
    reset(); setPhase("preparing"); setNotice(null); const out = [];
    for (const [i, file] of files.entries()) {
      setProgress({ done: i, total: files.length });
      try { const r = await prepare(file); const preview = URL.createObjectURL(r.blob); urls.current.push(preview); out.push({ file: file.name, width: r.width, height: r.height, blob: r.blob, preview }); }
      catch { out.push({ file: file.name, width: 0, height: 0, error: "not a picture" }); }
    }
    setPrepared(out); setProgress(null); setPhase("preview");
  };
  const runImport = async () => {
    const toSend = items.filter((i) => WILL_SAVE.includes(i.status)); const batchId = newBatchId(); const results = []; setPhase("importing"); setError(null); setNotice(null);
    try {
      for (const group of inBatches(toSend)) {
        setProgress({ done: results.length, total: toSend.length });
        const r = await uploadPhotos(getStoredToken(), batchId, group.map((i) => ({ name: `${i.code}.jpg`, blob: i.blob })), replace); results.push(...r.results);
      }
      setProgress(null); setReport({ saved: results.filter((r) => r.status === "saved").length, kept: results.filter((r) => r.status === "kept").length, problems: results.filter((r) => !["saved", "kept"].includes(r.status)) }); setPhase("done"); await reload();
    } catch (err) {
      setProgress(null); setPhase("preview"); await reload().catch(() => {});
      if (!expired(err)) setError(`${err.message}. ${results.filter((r) => r.status === "saved").length} pictures were saved before it stopped: they are in the list of earlier imports below, and can be undone.`);
    }
  };
  const act = async (fn) => { setBusy(true); setError(null); setNotice(null); try { await fn(); } catch (err) { if (!expired(err)) setError(err.message); } finally { setBusy(false); } };
  const shot = (missing) => act(() => downloadShotList(getStoredToken(), missing));
  const undo = (id) => act(async () => { const r = await undoBatch(getStoredToken(), id); setConfirmUndo(null); setNotice(`Undone: ${r.restored} ${r.restored === 1 ? "picture" : "pictures"} put back${r.changedSince ? ` (${r.changedSince} changed since, left as they are)` : ""}.`); await reload(); });
  const toggleFallback = (on) => act(async () => { const r = await saveFallback(getStoredToken(), on); setCov((c) => ({ ...c, fallback: r.fallback })); setNotice(r.fallback ? "On: a section or part with no picture of its own now shows a product's photo (within about half a minute)." : "Off: the \"photo coming soon\" tile is shown again."); });

  if (loadError) return <div role="alert" style={{ ...body, fontSize: 13, color: C.red }}>{loadError}</div>;
  if (!cov) return <div style={{ ...body, fontSize: 13, color: C.muted }}>Loading…</div>;
  const shown = onlyProblems ? items.filter((i) => PROBLEMS.includes(i.status)) : items;
  return (
    <div>
      {error && <div role="alert" style={{ ...body, fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>}
      {notice && <div role="status" style={{ ...body, fontSize: 13, color: "#16794F", marginBottom: 12 }}>{notice}</div>}

      <div style={card}>
        <h2 style={h2}>Catalog photos: where we are</h2>
        <p style={hint}>A section or part with no real picture shows a "photo coming soon" tile. Parts that are only different sizes of one thing share one picture.</p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 220 }}><div style={{ ...body, fontSize: 12.5, marginBottom: 4 }}><b>Sections</b>: {cov.totals.sectionsWithPhoto} of {cov.totals.sections} have a picture</div><Bar done={cov.totals.sectionsWithPhoto} total={cov.totals.sections} label="Sections with a picture" /></div>
          <div style={{ flex: 1, minWidth: 220 }}><div style={{ ...body, fontSize: 12.5, marginBottom: 4 }}><b>Parts</b>: {cov.totals.partsWithPhoto} of {cov.totals.parts} have a picture</div><Bar done={cov.totals.partsWithPhoto} total={cov.totals.parts} label="Parts with a picture" /></div>
        </div>
        <div style={{ ...body, fontSize: 13, marginBottom: 10 }}>Pictures still to make: <b>{needed}</b> of {cov.totals.pictures}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button type="button" style={button} disabled={busy} onClick={() => shot(false)}>Download the shot list (everything)</button>
          <button type="button" style={button} disabled={busy} onClick={() => shot(true)}>Download the shot list (only what is missing)</button>
        </div>
        <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${C.line}`, borderRadius: 8 }}>
          <table style={{ ...body, width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "start", color: C.muted }}><th style={{ padding: "6px 8px" }}>Code</th><th>Section</th><th>Section picture</th><th style={{ width: 180 }}>Parts with a picture</th></tr></thead>
            <tbody>{cov.sections.map((s) => (
              <tr key={s.id} data-testid={`cov-${s.code}`} style={{ borderTop: `1px solid ${C.line}` }}><td style={{ padding: "6px 8px", fontWeight: 600 }}>{s.code}</td><td>{s.nameEn}</td><td>{s.hasPhoto ? "yes" : "no"}</td><td style={{ paddingInlineEnd: 8 }}>{s.partsWithPhoto} / {s.parts}<Bar done={s.partsWithPhoto} total={s.parts} label={`${s.nameEn} parts with a picture`} /></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>Import pictures</h2>
        <p style={hint}>Choose the pictures (select the whole folder at once). Each must be named by its code: <b>BRK.jpg</b> for a section, <b>BRK-001.jpg</b> for a part. Each is cropped to its centre square and saved at {PHOTO_PX} × {PHOTO_PX}, so start from at least {MIN_SOURCE_PX} × {MIN_SOURCE_PX}. <b>Nothing is saved until you press Import.</b></p>
        {(phase === "idle" || phase === "done") && <label style={{ ...primary, display: "inline-block" }}>Choose pictures<input type="file" multiple accept="image/jpeg,image/png,image/webp" data-testid="photo-files" aria-label="Choose pictures" style={{ display: "none" }} onChange={choose} /></label>}
        {(phase === "preparing" || phase === "importing") && progress && <div style={{ marginTop: 6 }}><div style={{ ...body, fontSize: 12.5, marginBottom: 4 }}>{phase === "preparing" ? "Reading the pictures" : "Saving"}: {progress.done} of {progress.total}</div><Bar done={progress.done} total={progress.total} label="Progress" /></div>}
        {phase === "preview" && (
          <>
            <div style={{ ...body, fontSize: 13, margin: "4px 0 8px" }}><b>{counts.willSave}</b> will be saved · <b>{counts.kept}</b> already have a picture (kept) · <b>{counts.problems}</b> {counts.problems === 1 ? "problem" : "problems"}</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
              <label style={{ ...body, fontSize: 12.5 }}><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace pictures that are already real (otherwise they are kept)</label>
              <label style={{ ...body, fontSize: 12.5 }}><input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Show only the problems</label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, maxHeight: 420, overflowY: "auto", marginBottom: 12 }}>
              {shown.map((i, n) => { const [fg, bg] = chipColors(i.status); return (
                <div key={`${i.file}-${n}`} data-testid="photo-card" style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: 6 }}>
                  <div style={{ height: 90, borderRadius: 6, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", ...body, fontSize: 11, color: C.muted }}>{i.preview ? <img src={i.preview} alt={`Preview of ${i.file}`} style={{ height: "100%", width: "100%", objectFit: "cover" }} /> : "no preview"}</div>
                  <div style={{ ...body, fontSize: 11.5, marginTop: 4, wordBreak: "break-all" }}>{i.file}</div>
                  <span style={{ ...body, display: "inline-block", fontSize: 11, borderRadius: 99, padding: "1px 8px", marginTop: 3, color: fg, background: bg }}>{LABELS[i.status]}</span>
                  {i.applies.length > 1 && <div style={{ ...body, fontSize: 11, color: C.muted, marginTop: 2 }}>also {i.applies.filter((c) => c !== i.code).join(", ")}</div>}
                </div>); })}
            </div>
            <div style={{ display: "flex", gap: 8 }}><button type="button" style={primary} disabled={counts.willSave === 0} onClick={runImport}>Import {counts.willSave} {counts.willSave === 1 ? "picture" : "pictures"}</button><button type="button" style={button} onClick={reset}>Start over</button></div>
          </>
        )}
        {phase === "done" && report && (
          <div role="status" style={{ ...body, fontSize: 13, marginTop: 12 }}>
            <b>Done.</b> {report.saved} saved · {report.kept} kept (already had a picture){report.problems.length > 0 && <> · {report.problems.length} not saved:</>}
            {report.problems.length > 0 && <ul style={{ margin: "4px 0 0", paddingInlineStart: 20 }}>{report.problems.map((p, n) => <li key={n}>{p.file}: {SERVER_PROBLEM[p.status] || p.status}</li>)}</ul>}
            <div style={{ color: C.muted, marginTop: 6 }}>The website shows the new pictures within about a minute. You can undo this import below.</div>
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={h2}>Earlier imports</h2>
        {batches.length === 0 ? <p style={hint}>None yet. The last 5 imports can be undone.</p> : (
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>{batches.map((b) => (
            <li key={b.id} data-testid={`batch-${b.id}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${C.line}`, ...body, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{new Date(b.at).toLocaleString("en-GB")} · {b.count} {b.count === 1 ? "picture" : "pictures"}{b.undone ? " · undone" : ""}</span>
              {!b.undone && (confirmUndo === b.id ? <><span>Put the old pictures back?</span><button type="button" style={primary} disabled={busy} onClick={() => undo(b.id)}>Yes, undo</button><button type="button" style={button} onClick={() => setConfirmUndo(null)}>No</button></> : <button type="button" style={button} onClick={() => setConfirmUndo(b.id)} aria-label={`Undo the import of ${new Date(b.at).toLocaleString("en-GB")}`}>Undo</button>)}
            </li>))}</ul>
        )}
      </div>

      <div style={card}>
        <h2 style={h2}>Until a picture is ready</h2>
        <label style={{ ...body, fontSize: 13, display: "block", marginTop: 8 }}>
          <input type="checkbox" checked={cov.fallback} disabled={busy} onChange={(e) => toggleFallback(e.target.checked)} /> Show a product's own photo for a section or part that has no picture yet
        </label>
        <p style={hint}>Off: the "photo coming soon" tile. On: the website shows the first photo of the best-rated live product instead (the pictures differ in style, and a supplier's photo can carry a logo). This only changes what shoppers see: the numbers above still count only real pictures.</p>
      </div>
    </div>
  );
}
