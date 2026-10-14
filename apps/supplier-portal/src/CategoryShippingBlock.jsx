import React from "react";
import { C, useBodyFont } from "./theme";
import { useLang } from "./langContext";

const T = {
  zh: { title: "重量和尺寸", from: (name) => `来自分类「${name}」`, weight: "重量", length: "长度", width: "宽度", height: "高度", hint: "无需填写。" },
  en: { title: "Weight and size", from: (name) => `From the category ${name}`, weight: "Weight", length: "Length", width: "Width", height: "Height", hint: "You do not need to enter them." },
};

/** Shown instead of the four weight and size inputs when the product's category has them (set by the admin). Read-only. */
export default function CategoryShippingBlock({ category, shipping }) {
  const font = useBodyFont();
  const { lang } = useLang();
  const t = T[lang === "zh" ? "zh" : "en"];
  const name = lang === "zh" ? (category.nameZh || category.nameEn) : category.nameEn;
  const cell = (label, value) => (
    <div>
      <div style={{ ...font, fontSize: 12, fontWeight: 700, color: C.muted }}>{label}</div>
      <div style={{ ...font, fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 3 }}>{value}</div>
    </div>
  );
  return (
    <div data-testid="category-shipping" style={{ gridColumn: "1 / -1", border: `1px solid ${C.line}`, borderRadius: 10, background: "#F9FAFB", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink }}>{t.title}</div>
        <span style={{ ...font, fontSize: 11.5, fontWeight: 700, color: "#1E3F9A", background: C.torqueBg, borderRadius: 999, padding: "3px 10px" }}>{t.from(name)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {cell(t.weight, `${shipping.weightKg} kg`)}
        {cell(t.length, `${shipping.lengthCm} cm`)}
        {cell(t.width, `${shipping.widthCm} cm`)}
        {cell(t.height, `${shipping.heightCm} cm`)}
      </div>
      <div style={{ ...font, fontSize: 12, color: "#4B5563" }}>{t.hint}</div>
    </div>
  );
}
