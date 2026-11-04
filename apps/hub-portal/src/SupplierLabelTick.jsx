import React from "react";
import { useLang } from "./langContext";

// At the "Packed" step: the supplier's striped "hub use only" label must be removed (a new box) or fully covered by the delivery label, so a
// delivery driver never scans the wrong code. "Confirm Packed" waits for this tick, and the server refuses the step without it. The same as the
// hub app (lib/features/shipment/shipment_detail_screen.dart).
const TEXT = {
  zh: { title: "供应商标签已撕除或已完全覆盖", hint: "条纹“仅限质检中心”标签——换新箱，或用派送标签覆盖", need: "确认已打包前请勾选此项。" },
  en: { title: "The supplier's label is removed or fully covered", hint: "The striped \"hub use only\" label: a new box, or the delivery label stuck over it", need: "Tick this before \"Confirm Packed\"." },
};

export default function SupplierLabelTick({ checked, onChange }) {
  const { lang } = useLang();
  const x = TEXT[lang] || TEXT.en;
  const tone = checked ? { border: "#1E9D6B", bg: "#E4F5EC" } : { border: "#C0362C", bg: "#FBE7E5" };
  return (
    <div data-testid="supplier-label-tick" style={{ marginTop: 16, fontFamily: "'Inter', sans-serif" }}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1.5px solid ${tone.border}`, background: tone.bg, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 17, height: 17, marginTop: 1, accentColor: "#1E9D6B", cursor: "pointer" }} />
        <span><b style={{ fontSize: 13, color: "#14171C" }}>{x.title}</b><br /><span style={{ fontSize: 11.5, color: "#6B7280" }}>{x.hint}</span></span>
      </label>
      {!checked && <div style={{ fontSize: 11.5, color: "#C0362C", fontWeight: 600, marginTop: 6 }}>{x.need}</div>}
    </div>
  );
}
