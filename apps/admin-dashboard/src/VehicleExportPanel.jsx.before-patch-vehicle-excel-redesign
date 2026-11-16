import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken, fetchBrands, downloadVehicleExport } from "./auth";

// "Download Excel" on the Vehicle Data page: every version of one brand (or of all brands) in one sheet, the English, Arabic and Chinese
// columns side by side and the vehicle photo in its cell -- the same layout as the import sheet.
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

  const box = { border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, background: C.card, marginBottom: 14 };
  const button = { ...body, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: busy ? "#D1D5DB" : C.signal, color: C.onSignal, fontSize: 12.5, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" };
  return (
    <div style={box}>
      <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Download the vehicle data as an Excel sheet</div>
      <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 12 }}>
        One row = one version of a vehicle in one year: brand, model, year, version, engine and seats in English, Arabic and Chinese, and the vehicle photo in its cell (click it to open it full size). All brands can take a minute because of the photos.
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label htmlFor="vehicle-export-brand" style={{ ...body, fontSize: 12.5, color: C.ink, fontWeight: 600 }}>Brand</label>
        <select id="vehicle-export-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={busy}
          style={{ ...body, fontSize: 12.5, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, background: C.card, color: C.ink, minWidth: 200 }}>
          <option value="">All brands</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}{b.nameAr ? ` / ${b.nameAr}` : ""}</option>)}
        </select>
        <button onClick={handleDownload} disabled={busy} style={button}>
          <Download size={14} /> {busy ? "Preparing the file…" : "Download Excel (.xlsx)"}
        </button>
      </div>
      {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, background: "#FBE7E5", borderRadius: 8, padding: 10, marginTop: 12 }}>{error}</div>}
      {done && <div style={{ ...body, fontSize: 12.5, color: "#16794F", marginTop: 12 }}>Downloaded {done}</div>}
    </div>
  );
}
