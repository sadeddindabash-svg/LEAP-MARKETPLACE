import React from "react";
import { useLang } from "./langContext";

// After "Shipped to buyer" the hub has nothing more to do: the parcel becomes Delivered by itself when the driver scans its QR code and enters the
// code the buyer gives him face to face. While it is on its way this card says so; once delivered it shows how it was confirmed. The same as
// the hub app (lib/features/shipment/delivery_status.dart).
const C = { ink: "#14171C", line: "#E4E6EA", muted: "#6B7280", signal: "#E8622C", gauge: "#1E9D6B", gaugeBg: "#E4F5EC", amber: "#B9791F" };
const body = { fontFamily: "'Inter', sans-serif" };
const disp = { fontFamily: "'Barlow Condensed', sans-serif" };
const TEXT = {
  zh: {
    onWay: "运往买家途中", onWayHint: "无需操作。司机扫描包裹二维码并输入买家当面提供的验证码后，将自动变为“已送达”。",
    shipped: "已发货给买家", waiting: "等待买家验证码", waitingHint: "司机在门口确认", delivered: "已送达",
    verified: "司机已凭买家验证码确认", unverified: "未经买家验证码确认", receivedBy: "签收人", driver: "司机",
    received: { buyer: "买家本人", family: "家人", reception: "门卫 / 前台", door: "放在门口" },
  },
  en: {
    onWay: "On its way to the buyer", onWayHint: "Nothing to do here. It becomes Delivered by itself when the driver scans the parcel's QR code and enters the code the buyer gives him face to face.",
    shipped: "Shipped to the buyer", waiting: "Waiting for the buyer's code", waitingHint: "the driver confirms at the door", delivered: "Delivered",
    verified: "Confirmed with the buyer's code", unverified: "Not confirmed with the buyer's code", receivedBy: "Received by", driver: "Driver",
    received: { buyer: "Buyer", family: "Family member", reception: "Guard / reception", door: "Left at the door" },
  },
};

function Dot({ kind }) {
  const style = { width: 18, height: 18, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800 };
  if (kind === "done") return <span style={{ ...style, background: C.gauge }}>✓</span>;
  if (kind === "now") return <span style={{ ...style, border: `2px solid ${C.signal}` }} />;
  return <span style={{ ...style, border: "2px solid #D1D5DB" }} />;
}

export default function DeliveryStatusCard({ shipment }) {
  const { lang } = useLang();
  const x = TEXT[lang] || TEXT.en;
  const when = (d) => (d ? new Date(d).toLocaleString() : "");
  if (shipment.status === "delivered") {
    const proof = shipment.deliveryProof || null;
    const at = shipment.deliveredAt || (proof && proof.deliveredAt);
    const verified = Boolean(proof && proof.verified);
    return (
      <div data-testid="delivered-card" style={{ background: C.gaugeBg, border: `1px solid ${C.gauge}`, borderRadius: 12, padding: 16, ...body }}>
        <div style={{ ...disp, fontSize: 20, fontWeight: 800, color: C.gauge }}>✓ {x.delivered}</div>
        <div style={{ marginTop: 6 }}>
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 800, borderRadius: 20, padding: "2px 9px", background: "#fff", color: verified ? C.gauge : C.amber }}>{verified ? x.verified : x.unverified}</span>
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
          {when(at)}
          {proof && proof.receivedBy && <> · {x.receivedBy}: {x.received[proof.receivedBy] || proof.receivedBy}</>}
          {proof && proof.driver && proof.driver.name && <><br />{x.driver}: {[proof.driver.name, proof.driver.company].filter(Boolean).join(" · ")}</>}
        </div>
      </div>
    );
  }
  const shippedEvent = [...(shipment.events || [])].reverse().find((e) => e.step === "shipped_to_buyer");
  return (
    <div data-testid="on-its-way-card" style={{ background: C.card || "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, ...body, backgroundColor: "#fff" }}>
      <div style={{ ...disp, fontSize: 17, fontWeight: 700, color: C.ink }}>🚚 {x.onWay}</div>
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{x.onWayHint}</div>
      <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 12.5 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Dot kind="done" /><span>{x.shipped}{shippedEvent ? <span style={{ color: C.muted }}> · {[shippedEvent.trackingNumber, when(shippedEvent.createdAt)].filter(Boolean).join(" · ")}</span> : null}</span></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Dot kind="now" /><span><b>{x.waiting}</b> <span style={{ color: C.muted }}>· {x.waitingHint}</span></span></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Dot kind="next" /><span style={{ color: C.muted }}>{x.delivered}</span></div>
      </div>
    </div>
  );
}
