import React, { useEffect, useState } from "react";
import { C, useBodyFont } from "./theme";
import { useLang } from "./langContext";
import { fetchVersionsForGeneration } from "./auth";

const T = {
  en: {
    title: "Versions (optional)", all: "All versions of this car (default)", some: "Only some versions", seats: "seats",
    hint: "Choose versions only when the part is NOT right for all of them (for example brake discs that differ by trim). Most parts fit every version.",
    none: "No versions are listed for this car: the part fits the whole year.",
  },
  zh: {
    title: "车型版本（可选）", all: "此车型的所有版本（默认）", some: "仅部分版本", seats: "座",
    hint: "仅当该零件并不适用于所有版本时才选择（例如不同配置的刹车盘不同）。大多数零件适用于所有版本。",
    none: "此车型暂无版本信息：零件适用于全年款。",
  },
};

/**
 * The OPTIONAL step after the year: a part can be narrowed to some VERSIONS of the car (for example the AWD versions only). The default is "All versions": a simple part needs no extra click.
 * `value` is { mode: "all" | "some", ids: [version ids] }; the form sends versionIds only for "some". A car whose generation has no versions in the catalogue shows a grey note and nothing to choose.
 * It starts over whenever another car (generation or year) is chosen.
 */
export default function VersionsStep({ generationId, year, value, onChange }) {
  const font = useBodyFont();
  const { lang } = useLang();
  const t = T[lang === "zh" ? "zh" : "en"];
  const [versions, setVersions] = useState(null);       // null: not asked yet, or loading

  useEffect(() => {
    onChange({ mode: "all", ids: [] });
    setVersions(null);
    if (!generationId || !year) return undefined;
    let live = true;
    fetchVersionsForGeneration(generationId).then((v) => { if (live) setVersions(Array.isArray(v) ? v : []); }).catch(() => { if (live) setVersions([]); });
    return () => { live = false; };
  }, [generationId, year]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!generationId || !year || versions === null) return null;
  const label = { ...font, display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 };
  if (versions.length === 0) {
    return (
      <div data-testid="versions-step">
        <div style={label}>{t.title}</div>
        <div data-testid="versions-none" style={{ ...font, fontSize: 12.5, color: C.muted, background: "#F1F3F5", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px" }}>{t.none}</div>
      </div>
    );
  }
  const some = value.mode === "some";
  const toggle = (id) => onChange({ mode: "some", ids: value.ids.includes(id) ? value.ids.filter((x) => x !== id) : [...value.ids, id] });
  const radio = (mode, text, testid) => (
    <label style={{ ...font, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, margin: "5px 0", cursor: "pointer" }}>
      <input type="radio" name="version-mode" data-testid={testid} checked={value.mode === mode} onChange={() => onChange({ mode, ids: mode === "all" ? [] : value.ids })} />
      <span style={{ fontWeight: mode === "some" && some ? 700 : 400 }}>{text}</span>
    </label>
  );
  return (
    <div data-testid="versions-step">
      <div style={label}>{t.title}</div>
      {radio("all", t.all, "versions-mode-all")}
      {radio("some", t.some, "versions-mode-some")}
      {some && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "6px 0 4px 22px" }}>
          {versions.map((v) => {
            const on = value.ids.includes(v.id);
            const name = lang === "zh" ? (v.nameZh || v.name) : v.name;
            return (
              <label key={v.id} style={{ ...font, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, borderRadius: 999, padding: "5px 11px", cursor: "pointer", border: on ? `2px solid ${C.signal}` : `1px solid ${C.line}`, background: on ? "#FFF8E5" : "#fff" }}>
                <input type="checkbox" data-testid={`version-${v.id}`} checked={on} onChange={() => toggle(v.id)} />
                <b style={{ fontWeight: on ? 700 : 600 }}>{name}</b>
                <span style={{ color: C.muted }}>{[v.engine, v.seats ? `${v.seats} ${t.seats}` : null].filter(Boolean).join(" · ")}</span>
              </label>
            );
          })}
        </div>
      )}
      <div style={{ ...font, fontSize: 11.5, color: C.muted, marginTop: 5, lineHeight: 1.45 }}>{t.hint}</div>
    </div>
  );
}
