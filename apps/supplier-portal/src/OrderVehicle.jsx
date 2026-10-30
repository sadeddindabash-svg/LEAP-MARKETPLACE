import React from "react";
import { Car, Package, ArrowRight } from "lucide-react";
import { C, useBodyFont } from "./theme";
import { useLang } from "./langContext";
import { API_BASE_URL } from "./auth";

// The PART and the CAR IT BELONGS TO, on the supplier's Orders page, so the supplier is sure which part to send to the hub: the part's main photo, an arrow, and the car (photo and details) the product is
// listed for, IN FULL: brand, model, generation, year, engine, transmission and the VERSIONS the part is for ("All versions" when it is not narrowed). It never shows the buyer's car. `vehicle` is what
// GET /supplier/me/orders gives each item:
//   { partPhotoUrl, fitsAnyCar, carCount, cars: [{ year, brand, model, engine, transmission, photoUrl, generation: { name, yearStart, yearEnd, versionCount }, versions: null | [{ id, name, engine, seats }] }] }
//   (names are { en, ar, zh }; at most 4 cars are sent, carCount is the real total; versions null = every version; versionCount = how many versions the generation has)
const TEXT = {
  en: {
    header: "Part \u2192 Car", part: "The part", fitsThis: "Fits this car", fitsAny: "Fits any car: no car to match", fitsAnyShort: "Fits any car", fitsAnyItem: "fits any car", also: "Also listed for:", more: (n) => `+${n} more`,
    brand: "Brand", model: "Model", generation: "Generation", year: "Year", engine: "Engine", transmission: "Transmission", version: "Version", seats: "seats", present: "present",
    allVersions: "All versions", someVersions: (n, total) => (total > n ? `${n} of ${total} versions` : "Only some versions"),
    onlyThese: "This part is for these versions only: check the version before you send it to the hub.", moreItems: (n) => `+${n} more items`, moreCars: (n) => `(+${n} more cars)`,
  },
  zh: {
    header: "\u96f6\u4ef6 \u2192 \u8f66\u8f86", part: "\u96f6\u4ef6", fitsThis: "\u9002\u914d\u6b64\u8f66\u578b", fitsAny: "\u901a\u7528\u4ef6\uff0c\u9002\u914d\u4efb\u610f\u8f66\u578b", fitsAnyShort: "\u901a\u7528\u4ef6", fitsAnyItem: "\u901a\u7528\u4ef6\uff0c\u9002\u914d\u4efb\u610f\u8f66\u578b", also: "\u540c\u65f6\u9002\u914d\uff1a", more: (n) => `\u53e6\u6709${n}\u6b3e`,
    brand: "\u54c1\u724c", model: "\u8f66\u578b", generation: "\u5e74\u6b3e\u8303\u56f4", year: "\u5e74\u4efd", engine: "\u53d1\u52a8\u673a", transmission: "\u53d8\u901f\u7bb1", version: "\u7248\u672c", seats: "\u5ea7", present: "\u81f3\u4eca",
    allVersions: "\u6240\u6709\u7248\u672c", someVersions: (n, total) => (total > n ? `${total}\u4e2a\u7248\u672c\u4e2d\u7684${n}\u4e2a` : "\u4ec5\u90e8\u5206\u7248\u672c"),
    onlyThese: "\u6b64\u96f6\u4ef6\u4ec5\u9002\u7528\u4e8e\u8fd9\u4e9b\u7248\u672c\uff1a\u53d1\u5f80\u96c6\u8fd0\u4ed3\u524d\u8bf7\u6838\u5bf9\u7248\u672c\u3002", moreItems: (n) => `\u53e6\u6709${n}\u4ef6\u5546\u54c1`, moreCars: (n) => `\uff08\u53e6\u6709${n}\u6b3e\uff09`,
  },
};
const pick = (names, lang) => (names ? (lang === "zh" ? names.zh || names.en : names.en) : "");
const src = (url) => (url ? (url.startsWith("http") ? url : `${API_BASE_URL}${url}`) : null);
/** "BAIC BJ60 · 2022" */
export const carTitle = (car, lang) => `${[pick(car.brand, lang), pick(car.model, lang)].filter(Boolean).join(" ")} \u00b7 ${car.year}`;
/** "2.0T · automatic" (what the fitment says about the engine and transmission, when it says anything) */
export const carDetail = (car) => [car.engine, car.transmission].filter(Boolean).join(" \u00b7 ");
export const carHeader = (lang) => (TEXT[lang] || TEXT.en).header;

/** The versions of a car: "some" (the part is narrowed to them), "all" (the generation has versions and the part is for every one), or "none" (the generation has no versions in the catalogue: nothing to say). */
export function versionInfo(car, lang) {
  const t = TEXT[lang] || TEXT.en;
  const some = Array.isArray(car.versions) && car.versions.length > 0;
  const total = (car.generation && car.generation.versionCount) || 0;
  if (some) return { kind: "some", names: car.versions.map((v) => pick(v.name, lang)), versions: car.versions, label: t.someVersions(car.versions.length, total) };
  if (total > 0) return { kind: "all", label: t.allVersions };
  return { kind: "none" };
}
/** "2022 – present": the generation's years, only when it spans more than the one year already shown. */
export function generationYears(car, lang) {
  const t = TEXT[lang] || TEXT.en;
  const g = car.generation;
  if (!g || !g.yearStart || g.yearStart === g.yearEnd) return null;
  return `${g.yearStart} \u2013 ${g.yearEnd || t.present}`;
}

/** "2 motors · 5 seats" (Chinese: "5座", no space) */
export function versionFacts(v, lang) {
  const t = TEXT[lang] || TEXT.en;
  return [v.engine, v.seats ? `${v.seats}${lang === "zh" ? "" : " "}${t.seats}` : null].filter(Boolean).join(" \u00b7 ");
}

// Mouse over a photo (the part or the car) and it shows large beside it, the whole photo with its name: 360 x 360 in the order
// details, 220 x 220 for the small photos of the orders list. It closes when the mouse leaves (or the page scrolls).
function Photo({ url, width, height, label, Icon, zoom = width >= 90 ? 360 : 220 }) {
  const address = src(url);
  const font = useBodyFont();
  const [at, setAt] = React.useState(null);
  React.useEffect(() => {
    if (!at) return undefined;
    const close = () => setAt(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [at]);
  const open = (e) => {
    if (!address || !zoom) return;
    const r = e.currentTarget.getBoundingClientRect();
    const boxW = zoom + 18;
    const boxH = zoom + 44;
    const left = r.right + 10 + boxW <= window.innerWidth ? r.right + 10 : Math.max(8, r.left - 10 - boxW);
    const top = Math.min(Math.max(8, r.top - 20), Math.max(8, window.innerHeight - boxH - 8));
    setAt({ left, top });
  };
  return (
    <div
      data-testid="zoomable-photo"
      onMouseEnter={open}
      onMouseLeave={() => setAt(null)}
      style={{ width, height, borderRadius: 6, border: `1px solid ${C.line}`, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, cursor: address ? "zoom-in" : "default" }}
    >
      {address ? <img src={address} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon size={Math.round(height / 2.2)} color={C.muted} aria-hidden="true" />}
      {at ? (
        <div data-testid="photo-zoom" style={{ position: "fixed", left: at.left, top: at.top, zIndex: 1000, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.22)", padding: 8, pointerEvents: "none" }}>
          <img src={address} alt={label} style={{ width: zoom, height: zoom, objectFit: "contain", display: "block", background: C.canvas, borderRadius: 6 }} />
          <div style={{ ...font, fontSize: 12, fontWeight: 600, color: C.ink, textAlign: "center", marginTop: 6, maxWidth: zoom, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        </div>
      ) : null}
    </div>
  );
}

function VersionTag({ info }) {
  const font = useBodyFont();
  const some = info.kind === "some";
  return <span data-testid={`version-tag-${info.kind}`} style={{ ...font, display: "inline-block", borderRadius: 6, padding: "2px 8px", fontSize: 11.5, fontWeight: 700, background: some ? "#FFF3D6" : "#E3F4EA", color: some ? "#8A5A00" : "#0F6B49" }}>{info.label}</span>;
}

/** Under an item of the order detail: part photo, arrow, car photo and the car's details in full. */
export default function OrderVehicle({ vehicle }) {
  const font = useBodyFont();
  const { lang } = useLang();
  const t = TEXT[lang] || TEXT.en;
  if (!vehicle) return null;
  const caption = (text) => <div style={{ ...font, fontSize: 11, color: C.muted, marginTop: 3, textAlign: "center" }}>{text}</div>;
  const car = vehicle.cars && vehicle.cars[0];
  const others = (vehicle.cars || []).slice(1);
  const hidden = Math.max(0, (vehicle.carCount || 0) - (vehicle.cars || []).length);
  const alsoText = (c) => { const v = versionInfo(c, lang); return carTitle(c, lang) + (v.kind === "some" ? ` (${v.names.join(", ")})` : ""); };
  const facts = car ? [[t.brand, pick(car.brand, lang)], [t.model, pick(car.model, lang)], [t.generation, generationYears(car, lang)], [t.year, String(car.year)], [t.engine, car.engine], [t.transmission, car.transmission]].filter(([, value]) => value) : [];
  const versions = car ? versionInfo(car, lang) : null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
      <div><Photo url={vehicle.partPhotoUrl} width={96} height={96} label={t.part} Icon={Package} />{caption(t.part)}</div>
      {car ? (
        <>
          <ArrowRight size={26} color={C.muted} aria-hidden="true" style={{ marginTop: 34 }} />
          <div><Photo url={car.photoUrl} width={96} height={96} label={carTitle(car, lang)} Icon={Car} />{caption(t.fitsThis)}</div>
          <div data-testid="vehicle-details" style={{ ...font, fontSize: 12.5, lineHeight: 1.55, color: C.ink, minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14 }}><strong>{carTitle(car, lang)}</strong></div>
            <div style={{ display: "grid", gridTemplateColumns: "100px minmax(0, 1fr)", gap: "2px 10px", marginTop: 4 }}>
              {facts.map(([label, value]) => <React.Fragment key={label}><span style={{ color: C.muted }}>{label}</span><span>{value}</span></React.Fragment>)}
              {versions.kind !== "none" ? (
                <>
                  <span style={{ color: C.muted }}>{t.version}</span>
                  <span>
                    {versions.kind === "all" ? <VersionTag info={versions} /> : (
                      <>
                        <VersionTag info={versions} />
                        <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
                          {versions.versions.map((v) => (
                            <span key={v.id} data-testid={`version-chip-${v.id}`} style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 10px", background: "#fff" }}>
                              <strong>{pick(v.name, lang)}</strong>{versionFacts(v, lang) ? <span style={{ color: C.muted }}> {versionFacts(v, lang)}</span> : null}
                            </span>
                          ))}
                        </span>
                      </>
                    )}
                  </span>
                </>
              ) : null}
            </div>
            {versions.kind === "some" ? <div data-testid="version-warning" style={{ marginTop: 8, background: "#FFF8E5", border: "1px solid #F0D9A0", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#7A4E00" }}>{"\u26a0 "}{t.onlyThese}</div> : null}
            {others.length + hidden > 0 ? <div style={{ color: C.muted, marginTop: 6 }}>{t.also} {others.map(alsoText).join(", ")}{hidden > 0 ? ` ${t.more(hidden)}` : ""}</div> : null}
          </div>
        </>
      ) : <div style={{ ...font, fontSize: 12.5, color: C.muted, alignSelf: "center" }}>{t.fitsAny}</div>}
    </div>
  );
}

function CellRow({ item }) {
  const font = useBodyFont();
  const { lang } = useLang();
  const t = TEXT[lang] || TEXT.en;
  const vehicle = item.vehicle;
  const car = vehicle.cars && vehicle.cars[0];
  const muted = (text) => <span style={{ ...font, fontSize: 12.5, color: C.muted }}>{text}</span>;
  if (!car) {
    return (
      <div data-testid="ordercell-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Photo url={vehicle.partPhotoUrl} width={32} height={32} label={t.part} Icon={Package} />
        {muted(item.name ? `${item.name}${lang === "zh" ? "\uff1a" : ": "}${t.fitsAnyItem}` : t.fitsAnyShort)}
      </div>
    );
  }
  const versions = versionInfo(car, lang);
  const moreCars = Math.max(0, (vehicle.carCount || 1) - 1);
  return (
    <div data-testid="ordercell-item" style={{ ...font, fontSize: 12.5, color: C.ink, display: "flex", alignItems: "flex-start", gap: 6 }}>
      <Photo url={vehicle.partPhotoUrl} width={32} height={32} label={t.part} Icon={Package} />
      <ArrowRight size={14} color={C.muted} aria-hidden="true" style={{ marginTop: 9 }} />
      <Photo url={car.photoUrl} width={32} height={32} label={carTitle(car, lang)} Icon={Car} />
      <div style={{ minWidth: 0, lineHeight: 1.45 }}>
        <div><strong>{carTitle(car, lang)}</strong>{moreCars > 0 ? <span style={{ color: C.muted }}> {t.moreCars(moreCars)}</span> : null}</div>
        {versions.kind !== "none" ? <div><VersionTag info={versions} />{versions.kind === "some" ? <span style={{ color: C.muted }}> {versions.names.join(", ")}</span> : null}</div> : null}
        {carDetail(car) ? <div style={{ color: C.muted }}>{carDetail(car)}</div> : null}
      </div>
    </div>
  );
}

/** In the orders list: each item's part photo, arrow and car in full (the car's name, the versions, engine and transmission); the first two items, then "+N more items"; "Fits any car" for a part with no car; a dash when no item has information. */
export function OrderVehicleCell({ items }) {
  const font = useBodyFont();
  const { lang } = useLang();
  const t = TEXT[lang] || TEXT.en;
  const rows = (items || []).filter((i) => i && i.vehicle);
  if (rows.length === 0) return <span style={{ ...font, fontSize: 12.5, color: C.muted }}>{"\u2014"}</span>;
  const shown = rows.slice(0, 2);
  const more = rows.length - shown.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {shown.map((it, i) => <CellRow key={i} item={it} />)}
      {more > 0 ? <span style={{ ...font, fontSize: 12, color: C.muted }}>{t.moreItems(more)}</span> : null}
    </div>
  );
}
