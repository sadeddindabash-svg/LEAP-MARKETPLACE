import React, { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Check, AlertTriangle, ImagePlus } from "lucide-react";
import { C, body, disp, mono } from "./theme";
import { API_BASE_URL, SessionExpiredError, getStoredToken, fetchBrands, downloadVehicleExport } from "./auth";

// "Download Excel" on the Vehicle Data page: every version of one brand (or of all brands) in one sheet, the English, Arabic and Chinese
// columns side by side and the vehicle photo in its cell -- the same layout as the import sheet.
// patch-vehicle-excel-redesign: the brand chosen in a list with its logo and how many models it has, a picture of the sheet's columns, and the
// download in a bar (with what is being prepared, and the file name when it is done).
const mediaSrc = (url) => (url.startsWith("http") ? url : `${API_BASE_URL}${url}`);
const COLUMNS = [["Brand", true], ["Model", true], ["Year", false], ["Version", true], ["Engine", true], ["Seats", false], ["Photo", false]];
const SHEET_COLS = COLUMNS.reduce((n, [, three]) => n + (three ? 3 : 1), 0);

export default function VehicleExportPanel({ onSessionExpired }) {
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState("");          // "" = all brands
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    fetchBrands().then(setBrands).catch((err) => setError(err.message));
  }, []);

  const handleDownload = async () => {
    setBusy(true); setError(null); setDone(null);
    try {
      const { blob, fileName } = await downloadVehicleExport(getStoredToken(), brandId || null);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = fileName;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDone(fileName);
    } catch (err) {
      if (err instanceof SessionExpiredError) { onSessionExpired(); return; }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const chosen = brands.find((b) => b.id === brandId) || null;
  const totalModels = brands.reduce((n, b) => n + (Number(b.modelCount) || 0), 0);
  const hasCounts = brands.some((b) => b.modelCount !== undefined);
  const card = { border: `1px solid ${C.line}`, borderRadius: 14, background: "#fff", boxShadow: "0 1px 2px rgba(11,49,70,0.05)", marginBottom: 16, overflow: "hidden" };
  const cell = { padding: "7px 10px", borderRight: "1px solid #DDE5DF", borderBottom: "1px solid #DDE5DF", whiteSpace: "nowrap" };
  return (
    <div data-testid="vehicle-export">
      <div style={card}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", padding: 18, flexWrap: "wrap" }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "#E7F4EC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FileSpreadsheet size={22} color="#1D6F42" /></div>
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
            <div style={{ ...disp, fontSize: 15.5, fontWeight: 800, color: C.ink }}>Download the vehicle data as an Excel sheet</div>
            <div style={{ ...body, fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
              One row = one version of a vehicle in one year: brand, model, year, version, engine and seats in English, Arabic and Chinese, and the vehicle photo in its cell (click it to open it full size). All brands can take a minute because of the photos.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(0, 1.6fr)", gap: 18, padding: "0 18px 18px" }}>
          {/* which brand */}
          <div>
            <label htmlFor="vehicle-export-brand" style={{ ...body, display: "block", fontSize: 11.5, fontWeight: 800, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Brand</label>
            <select id="vehicle-export-brand" value={brandId} onChange={(e) => { setBrandId(e.target.value); setDone(null); }} disabled={busy}
              style={{ ...body, width: "100%", height: 42, fontSize: 13.5, fontWeight: 700, padding: "0 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.ink }}>
              <option value="">All brands</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}{b.nameAr ? ` / ${b.nameAr}` : ""}</option>)}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, padding: 12, borderRadius: 12, background: C.surfaceHigh, border: `1px solid ${C.line}` }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#fff", border: `1px solid ${C.line}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {chosen
                  ? (chosen.photoUrl ? <img src={mediaSrc(chosen.photoUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <ImagePlus size={18} color={C.muted} />)
                  : <span style={{ ...mono, fontSize: 15, fontWeight: 800, color: C.navy }}>{brands.length}</span>}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...body, fontSize: 14, fontWeight: 800, color: C.ink }}>{chosen ? chosen.name : "Every brand"}</div>
                <div style={{ ...body, fontSize: 12, color: C.muted }}>
                  {chosen
                    ? [chosen.nameAr, chosen.nameZh].filter(Boolean).join(" · ") + (chosen.modelCount !== undefined ? `${chosen.nameAr || chosen.nameZh ? " · " : ""}${chosen.modelCount} ${chosen.modelCount === 1 ? "model" : "models"}` : "")
                    : `${brands.length} ${brands.length === 1 ? "brand" : "brands"}${hasCounts ? ` · ${totalModels} ${totalModels === 1 ? "model" : "models"}` : ""} in one sheet`}
                </div>
              </div>
            </div>
          </div>

          {/* what the sheet looks like */}
          <div style={{ minWidth: 0 }}>
            <div style={{ ...body, fontSize: 11.5, fontWeight: 800, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>The sheet's columns</div>
            <div style={{ border: "1px solid #C9D8CE", borderRadius: 10, overflow: "hidden" }}>
              {/* a picture of the sheet (divs, not a table: the admin's table style would repaint it) */}
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${SHEET_COLS}, minmax(52px, auto))`, ...body, fontSize: 11.5, minWidth: "max-content" }}>
                  {COLUMNS.map(([name, three]) => <div key={name} style={{ ...cell, gridColumn: `span ${three ? 3 : 1}`, background: "#1D6F42", color: "#fff", borderColor: "#2E8656", fontWeight: 800 }}>{name}</div>)}
                  {COLUMNS.flatMap(([name, three]) => (three ? ["EN", "AR", "中文"] : [""]).map((l) => <div key={`${name}${l}`} style={{ ...cell, ...mono, background: "#E7F4EC", color: "#1D6F42", fontSize: 10, fontWeight: 800 }}>{l || " "}</div>))}
                  {["Toyota", "تويوتا", "丰田", "Camry", "كامري", "凯美瑞", "2020", "GLE", "جي إل إي", "豪华版", "2.5L", "2.5 لتر", "2.5升", "5"].map((v, i) => <div key={i} style={{ ...cell, color: C.muted, background: "#fff" }}>{v}</div>)}
                  <div style={{ ...cell, background: "#fff" }}><span style={{ display: "inline-flex", width: 34, height: 20, borderRadius: 4, background: "#DDE5DF", alignItems: "center", justifyContent: "center" }}><ImagePlus size={11} color="#1D6F42" /></span></div>
                </div>
              </div>
            </div>
            <div style={{ ...body, fontSize: 11.5, color: C.muted, marginTop: 6 }}>An example row. The same layout as the import template, so the file can be edited and imported again.</div>
          </div>
        </div>

        {error && <div role="alert" style={{ ...body, display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: C.redInk, background: C.redBg, padding: "10px 18px" }}><AlertTriangle size={15} /> {error}</div>}
        {done && <div role="status" style={{ ...body, display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, fontWeight: 700, color: "#16794F", background: "#EEF8F3", padding: "10px 18px" }}><Check size={15} /> Downloaded {done}</div>}

        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: `linear-gradient(120deg, ${C.navyDeep}, ${C.navy} 60%, ${C.navySoft} 140%)`, flexWrap: "wrap" }}>
          <span style={{ ...body, fontSize: 12.5, color: C.onNavyMuted, flex: "1 1 260px" }}>
            {busy ? `Preparing ${chosen ? chosen.name : "all brands"} with the photos…` : chosen ? `${chosen.name} only, every model, year and version.` : "All brands, every model, year and version."}
          </span>
          <button onClick={handleDownload} disabled={busy} style={{ ...body, display: "inline-flex", alignItems: "center", gap: 7, height: 42, padding: "0 22px", borderRadius: 10, border: `1px solid ${busy ? "#D1D5DB" : C.signalDark}`, background: busy ? "#D1D5DB" : C.signal, color: C.onSignal, fontSize: 14, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer" }}>
            <Download size={15} /> {busy ? "Preparing the file…" : "Download Excel (.xlsx)"}
          </button>
        </div>
      </div>
    </div>
  );
}
