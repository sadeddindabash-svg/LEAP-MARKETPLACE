import React from "react";
import { Car } from "lucide-react";
import { C, useBodyFont } from "./theme";
import { useLang } from "./langContext";
import { API_BASE_URL } from "./auth";
import { generationOptionLabel, pickerPhoto, vehicleCaption } from "./vehicleLabels";

const T = {
  zh: { carDetails: "车辆信息", brand: "品牌", model: "车型", year: "年份", whichYear: "具体年份", select: "请选择", carPhoto: "车辆照片", yearPhoto: "年份照片", brandPhoto: "品牌照片", byAdmin: "照片由管理员添加", present: "至今" },
  en: { carDetails: "Car details", brand: "Brand", model: "Model", year: "Year", whichYear: "Which year?", select: "Select…", carPhoto: "Car photo", yearPhoto: "Year photo", brandPhoto: "Brand photo", byAdmin: "Photo added by the admin", present: "present" },
};

/**
 * Choose the vehicle in three steps: Brand, then Model, then Year. Next to the steps, the photo the admin added: the YEAR's once a year is chosen, the
 * brand's before that, a car icon when there is none. `cascade` is the result of useVehicleCascade(). `compact` is the smaller version for Bulk upload.
 */
export default function VehiclePicker({ cascade, compact = false, idPrefix = "vehicle", children = null }) {
  const font = useBodyFont();
  const { lang } = useLang();
  const t = T[lang === "zh" ? "zh" : "en"];
  const photoSize = compact ? 130 : 320;
  const photo = pickerPhoto({ brand: cascade.selectedBrand, generation: cascade.selectedGeneration });
  // Brand and model in the supplier's language (the admin's Chinese names when there are some).
  const localName = (o) => (lang === "zh" && o?.nameZh ? o.nameZh : o?.name);
  const local = (o) => (o ? { ...o, name: localName(o) } : o);
  const caption = cascade.selectedBrand ? vehicleCaption({ brand: local(cascade.selectedBrand), model: local(cascade.selectedModel), generation: cascade.selectedGeneration, year: cascade.selectedYear }) : "";
  const src = photo.url ? (photo.url.startsWith("http") ? photo.url : `${API_BASE_URL}${photo.url}`) : null;

  const selectStyle = { ...font, width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff" };
  const step = (n, id, label, enabled, children) => (
    <div style={compact ? undefined : { flex: "1 1 0", minWidth: 0 }}>
      <label htmlFor={`${idPrefix}-${id}`} style={{ ...font, display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: enabled ? C.ink : C.muted, marginBottom: 6 }}>
        <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 999, background: enabled ? C.ink : C.line, color: enabled ? "#fff" : C.muted, fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
        {label}
      </label>
      {children}
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: `minmax(0, 1fr) ${photoSize}px`, gap: compact ? 16 : 28, alignItems: "start" }}>
      {/* Full size: Brand, Model and Year side by side, the versions (children) under them; this side is as tall as the photo beside it, and the versions scroll when there are many. */}
      <div style={compact ? undefined : { height: photoSize + 24, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!compact && <div style={{ ...font, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>{t.carDetails}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 14, ...(compact ? {} : { flex: 1, minHeight: 0 }) }}>
          <div style={compact ? { display: "flex", flexDirection: "column", gap: 10 } : { display: "flex", gap: 12 }}>
            {step(1, "brand", t.brand, true, (
              <select id={`${idPrefix}-brand`} style={selectStyle} value={cascade.selectedBrandId} onChange={(e) => cascade.chooseBrand(e.target.value)}>
                <option value="">{t.select}</option>
                {cascade.brands.map((b) => <option key={b.id} value={b.id}>{localName(b)}</option>)}
              </select>
            ))}
            {step(2, "model", t.model, Boolean(cascade.selectedBrandId), (
              <select id={`${idPrefix}-model`} style={selectStyle} value={cascade.selectedModelId} onChange={(e) => cascade.chooseModel(e.target.value)} disabled={!cascade.selectedBrandId}>
                <option value="">{t.select}</option>
                {cascade.models.map((m) => <option key={m.id} value={m.id}>{localName(m)}</option>)}
              </select>
            ))}
            {step(3, "year", t.year, Boolean(cascade.selectedModelId), (
              <select id={`${idPrefix}-year`} style={selectStyle} value={cascade.selectedGenerationId} onChange={(e) => cascade.chooseYearEntry(e.target.value)} disabled={!cascade.selectedModelId}>
                <option value="">{t.select}</option>
                {cascade.years.map((g) => <option key={g.id} value={g.id}>{generationOptionLabel(g, t.present)}</option>)}
              </select>
            ))}
          </div>
          {cascade.needsYearChoice && (
            <div>
              <label htmlFor={`${idPrefix}-which-year`} style={{ ...font, display: "block", fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
                {t.whichYear} ({cascade.selectedGeneration.yearStart}–{cascade.selectedGeneration.yearEnd || t.present})
              </label>
              <select id={`${idPrefix}-which-year`} style={selectStyle} value={cascade.selectedYear} onChange={(e) => cascade.setSelectedYear(e.target.value)}>
                <option value="">{t.select}</option>
                {cascade.yearChoices.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          {children && <div data-testid="picker-versions" style={{ flex: 1, minHeight: 0, overflow: "auto", borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>{children}</div>}
        </div>
      </div>
      <div>
        {!compact && <div style={{ ...font, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>{t.carPhoto}</div>}
        <div style={{ position: "relative", width: photoSize, height: photoSize, maxWidth: "100%", boxSizing: "border-box", borderRadius: 10, border: `1px solid ${C.line}`, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {src ? <img src={src} alt={caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Car size={compact ? 28 : 36} color={C.muted} aria-hidden="true" />}
          {photo.kind && (
            <span style={{ ...font, position: "absolute", left: 8, top: 8, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "2px 9px", background: photo.kind === "year" ? C.torqueBg : "#EEF0F3", color: photo.kind === "year" ? "#1E3F9A" : "#374151" }}>
              {photo.kind === "year" ? t.yearPhoto : t.brandPhoto}
            </span>
          )}
        </div>
        {caption && <div style={{ ...font, fontSize: compact ? 12 : 13, fontWeight: 700, color: C.ink, marginTop: 8 }}>{caption}</div>}
        {photo.url && !compact && <div style={{ ...font, fontSize: 11.5, color: C.muted, marginTop: 2 }}>{t.byAdmin}</div>}
      </div>
    </div>
  );
}
