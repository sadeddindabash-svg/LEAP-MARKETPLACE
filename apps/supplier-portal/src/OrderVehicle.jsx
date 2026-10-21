import React from "react";
import { Car } from "lucide-react";
import { C, useBodyFont } from "./theme";
import { useLang } from "./langContext";
import { API_BASE_URL } from "./auth";

// The CAR an order line is for, as the supplier sees it on the Orders page, so they are sure which part to send to the hub. The server records it when the order is placed (from the buyer's
// My Garage; the buyer does nothing new) together with a check against the product's fitment list. `vehicle` is what GET /supplier/me/orders gives each item:
//   null / missing  an order placed before this existed: nothing is shown.
//   { status, isDefaultCar, car }   status: listed | not_listed | no_car | universal;  car: { year, seats, photoUrl, brand, model, version, engine } with { en, ar, zh } names, or null.
const TEXT = {
  en: {
    car: "Car", buyersCar: "Buyer's car", defaultCar: "default car", otherCar: "another car in the buyer's garage", seats: (n) => `${n} seats`,
    listed: "Listed as fitting this car", notListed: "Not in this product's fitment list: please check before sending",
    noCar: "No car on file: the buyer has no car in My Garage", universal: "Fits any car: no car recorded", noCarShort: "No car on file", anyCar: "Fits any car", more: (n) => `+${n} more`, check: "check",
  },
  zh: {
    car: "车辆", buyersCar: "买家车辆", defaultCar: "默认车辆", otherCar: "买家车库中的另一辆车", seats: (n) => `${n}座`,
    listed: "该商品适配此车型", notListed: "该商品的适配列表中没有此车型，发货前请核对",
    noCar: "无车辆信息：买家的车库中没有车辆", universal: "通用件，适配任意车型，未记录车辆", noCarShort: "无车辆信息", anyCar: "通用件", more: (n) => `另有${n}辆`, check: "请核对",
  },
};
const pick = (names, lang) => (names ? (lang === "zh" ? names.zh || names.en : names.en) : "");
const src = (url) => (url ? (url.startsWith("http") ? url : `${API_BASE_URL}${url}`) : null);
/** "BAIC BJ60 · 2022" */
export const carTitle = (car, lang) => `${[pick(car.brand, lang), pick(car.model, lang)].filter(Boolean).join(" ")} · ${car.year}`;
/** "May Day · 2.0T (190 kW) · 5 seats" */
export const carDetail = (car, lang) => [pick(car.version, lang), pick(car.engine, lang), car.seats ? TEXT[lang].seats(car.seats) : ""].filter(Boolean).join(" · ");
export const carHeader = (lang) => (TEXT[lang] || TEXT.en).car;

function Photo({ car, width, height, label }) {
  const url = src(car && car.photoUrl);
  return (
    <div style={{ width, height, borderRadius: 6, border: `1px solid ${C.line}`, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
      {url ? <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Car size={Math.round(height / 2.2)} color={C.muted} aria-hidden="true" />}
    </div>
  );
}

/** Under an item of the order detail. */
export default function OrderVehicle({ vehicle }) {
  const font = useBodyFont();
  const { lang } = useLang();
  const t = TEXT[lang] || TEXT.en;
  if (!vehicle) return null;
  const note = (text, color) => <div style={{ ...font, fontSize: 12, color: color || C.muted, marginTop: 4 }}>{text}</div>;
  if (vehicle.status === "universal") return note(t.universal);
  if (vehicle.status === "no_car" || !vehicle.car) return note(t.noCar, "#8A5A12");
  const { car } = vehicle, listed = vehicle.status === "listed";
  return (
    <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "flex-start" }}>
      <Photo car={car} width={96} height={72} label={carTitle(car, lang)} />
      <div style={{ ...font, fontSize: 12.5, lineHeight: 1.55, color: C.ink }}>
        <div>{t.buyersCar}: <strong>{carTitle(car, lang)}</strong>{vehicle.isDefaultCar === false ? <span style={{ color: C.muted }}> ({t.otherCar})</span> : null}</div>
        <div style={{ color: C.muted }}>{carDetail(car, lang)}</div>
        <span role="status" style={{ display: "inline-block", marginTop: 4, fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "2px 10px", color: listed ? "#0F6B49" : "#8A5A12", background: listed ? "#E2F4EC" : "#FDF3E1" }}>
          {listed ? t.listed : t.notListed}
        </span>
      </div>
    </div>
  );
}

/** In the orders list: the first car (a small photo, brand, model and year), "+N" when the order has more, and a warning mark when a car is not on a product's fitment list. */
export function OrderVehicleCell({ items }) {
  const font = useBodyFont();
  const { lang } = useLang();
  const t = TEXT[lang] || TEXT.en;
  const vehicles = (items || []).map((i) => i.vehicle).filter(Boolean);
  const withCar = vehicles.filter((v) => v.car);
  const muted = (text) => <span style={{ ...font, fontSize: 12.5, color: C.muted }}>{text}</span>;
  if (withCar.length === 0) {
    if (vehicles.some((v) => v.status === "no_car")) return muted(t.noCarShort);
    return vehicles.length ? muted(t.anyCar) : muted("—");
  }
  const key = (v) => `${carTitle(v.car, "en")}|${carDetail(v.car, "en")}`;
  const distinct = [...new Map(withCar.map((v) => [key(v), v])).values()];
  const first = distinct[0].car;
  const warn = withCar.some((v) => v.status === "not_listed");
  return (
    <span style={{ ...font, fontSize: 12.5, color: C.ink, display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Photo car={first} width={38} height={28} label={carTitle(first, lang)} />
      <span>{carTitle(first, lang)}{distinct.length > 1 ? <span style={{ color: C.muted }}> {t.more(distinct.length - 1)}</span> : null}{warn ? <span style={{ color: "#8A5A12", fontWeight: 700 }}> ⚠ {t.check}</span> : null}</span>
    </span>
  );
}
