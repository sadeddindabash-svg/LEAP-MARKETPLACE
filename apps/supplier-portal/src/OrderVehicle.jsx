import React from "react";
import { Car, Package, ArrowRight } from "lucide-react";
import { C, useBodyFont } from "./theme";
import { useLang } from "./langContext";
import { API_BASE_URL } from "./auth";

// The PART and the CAR IT BELONGS TO, on the supplier's Orders page, so the supplier is sure which part to send to the hub: the part's main photo, an arrow, and the car (photo and name) the product is
// listed for. It never shows the buyer's car. `vehicle` is what GET /supplier/me/orders gives each item:
//   { partPhotoUrl, fitsAnyCar, carCount, cars: [{ year, brand, model, engine, transmission, photoUrl }] }   (names are { en, ar, zh }; at most 4 cars are sent, carCount is the real total)
const TEXT = {
  en: {
    header: "Part → Car", part: "The part", fitsThis: "Fits this car", fitsAny: "Fits any car: no car to match", fitsAnyShort: "Fits any car", also: "Also listed for:", more: (n) => `+${n} more`,
  },
  zh: {
    header: "零件 → 车辆", part: "零件", fitsThis: "适配此车型", fitsAny: "通用件，适配任意车型", fitsAnyShort: "通用件", also: "同时适配：", more: (n) => `另有${n}款`,
  },
};
const pick = (names, lang) => (names ? (lang === "zh" ? names.zh || names.en : names.en) : "");
const src = (url) => (url ? (url.startsWith("http") ? url : `${API_BASE_URL}${url}`) : null);
/** "BAIC BJ60 · 2022" */
export const carTitle = (car, lang) => `${[pick(car.brand, lang), pick(car.model, lang)].filter(Boolean).join(" ")} · ${car.year}`;
/** "2.0T · automatic" (what the fitment says about the engine and transmission, when it says anything) */
export const carDetail = (car) => [car.engine, car.transmission].filter(Boolean).join(" · ");
export const carHeader = (lang) => (TEXT[lang] || TEXT.en).header;

function Photo({ url, width, height, label, Icon }) {
  const address = src(url);
  return (
    <div style={{ width, height, borderRadius: 6, border: `1px solid ${C.line}`, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
      {address ? <img src={address} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon size={Math.round(height / 2.2)} color={C.muted} aria-hidden="true" />}
    </div>
  );
}

/** Under an item of the order detail: part photo, arrow, car photo and the car's details. */
export default function OrderVehicle({ vehicle }) {
  const font = useBodyFont();
  const { lang } = useLang();
  const t = TEXT[lang] || TEXT.en;
  if (!vehicle) return null;
  const caption = (text) => <div style={{ ...font, fontSize: 11, color: C.muted, marginTop: 3, textAlign: "center" }}>{text}</div>;
  const car = vehicle.cars && vehicle.cars[0];
  const others = (vehicle.cars || []).slice(1);
  const hidden = Math.max(0, (vehicle.carCount || 0) - (vehicle.cars || []).length);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
      <div><Photo url={vehicle.partPhotoUrl} width={110} height={82} label={t.part} Icon={Package} />{caption(t.part)}</div>
      {car ? (
        <>
          <ArrowRight size={26} color={C.muted} aria-hidden="true" />
          <div><Photo url={car.photoUrl} width={110} height={82} label={carTitle(car, lang)} Icon={Car} />{caption(t.fitsThis)}</div>
          <div style={{ ...font, fontSize: 12.5, lineHeight: 1.55, color: C.ink, minWidth: 0 }}>
            <div><strong>{carTitle(car, lang)}</strong></div>
            {carDetail(car) ? <div style={{ color: C.muted }}>{carDetail(car)}</div> : null}
            {others.length + hidden > 0 ? <div style={{ color: C.muted }}>{t.also} {others.map((c) => carTitle(c, lang)).join(", ")}{hidden > 0 ? ` ${t.more(hidden)}` : ""}</div> : null}
          </div>
        </>
      ) : <div style={{ ...font, fontSize: 12.5, color: C.muted }}>{t.fitsAny}</div>}
    </div>
  );
}

/** In the orders list: the first item's part photo, an arrow and its car (photo and name), "+N more" when the order has more cars; "Fits any car" when no item has one. */
export function OrderVehicleCell({ items }) {
  const font = useBodyFont();
  const { lang } = useLang();
  const t = TEXT[lang] || TEXT.en;
  const vehicles = (items || []).map((i) => i.vehicle).filter(Boolean);
  const muted = (text) => <span style={{ ...font, fontSize: 12.5, color: C.muted }}>{text}</span>;
  if (vehicles.length === 0) return muted("—");
  const first = vehicles.find((v) => v.cars && v.cars.length) || null;
  if (!first) return <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Photo url={vehicles[0].partPhotoUrl} width={38} height={28} label={t.part} Icon={Package} />{muted(t.fitsAnyShort)}</span>;
  const car = first.cars[0];
  const key = (c) => `${carTitle(c, "en")}|${carDetail(c)}`;
  const distinct = new Set(vehicles.flatMap((v) => (v.cars || []).map(key)));
  const hidden = vehicles.reduce((n, v) => n + Math.max(0, (v.carCount || 0) - (v.cars || []).length), 0);
  const extra = distinct.size - 1 + hidden;
  return (
    <span style={{ ...font, fontSize: 12.5, color: C.ink, display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Photo url={first.partPhotoUrl} width={38} height={28} label={t.part} Icon={Package} />
      <ArrowRight size={14} color={C.muted} aria-hidden="true" />
      <Photo url={car.photoUrl} width={38} height={28} label={carTitle(car, lang)} Icon={Car} />
      <span>{carTitle(car, lang)}{extra > 0 ? <span style={{ color: C.muted }}> {t.more(extra)}</span> : null}</span>
    </span>
  );
}
