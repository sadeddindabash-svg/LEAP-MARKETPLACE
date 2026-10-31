import React from "react";
import { C, body } from "./theme";
import { EnlargeablePhoto } from "./components/ui";

/**
 * PROOF OF DELIVERY on the admin order page (migrations 096 + 120).
 *
 * Confirmed by a signed-in partner driver WITH the buyer's code: "confirmed with the buyer's code", the driver and their company, who received
 * the parcel and a map link to where it was delivered (when the phone shared it). Photos sent before migration 120 (anyone holding the label
 * could send them) stay labelled "not verified". Below the box: every "couldn't deliver" the drivers recorded.
 */
const RECEIVED_BY = { buyer: "Buyer", family: "Family member", reception: "Guard / reception", door: "Left at the door" };
const mapUrl = (loc) => `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
const when = (t) => new Date(t).toLocaleString();

export default function DeliveryProofCard({ proof, attempts, apiBase }) {
  const list = Array.isArray(attempts) ? attempts : [];
  if (!proof && list.length === 0) return null;
  const line = { ...body, fontSize: 11.5, color: C.ink };
  const couriers = proof ? [...new Set(proof.photos.map((p) => p.courierName).filter(Boolean))] : [];
  const notes = proof ? [...new Set(proof.photos.map((p) => p.note).filter(Boolean))] : [];
  return (
    <>
      {proof && (
        <div data-testid="delivery-proof" style={{ marginTop: 10, background: "#fff", border: `1px solid ${proof.verified ? C.gauge : C.line}`, borderRadius: 8, padding: 10 }}>
          <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.ink }}>
            PROOF OF DELIVERY {proof.verified
              ? <span style={{ color: C.gauge }}>· confirmed by the driver with the buyer's code</span>
              : <span style={{ color: C.amber }}>· sent through the courier's link, not verified</span>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
            {proof.photos.map((p) => (
              <EnlargeablePhoto key={p.url} src={`${apiBase}${p.url}`} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.line}` }} />
            ))}
          </div>
          {proof.driver
            ? <div style={line}>Driver: {[proof.driver.name, proof.driver.company, proof.driver.phone].filter(Boolean).join(" · ")}</div>
            : couriers.length > 0 && <div style={line}>Courier: {couriers.join(", ")}</div>}
          {proof.receivedBy && <div style={line}>Received by: {RECEIVED_BY[proof.receivedBy] || proof.receivedBy}</div>}
          {notes.map((note) => <div key={note} style={line}>Note: {note}</div>)}
          {proof.location
            ? <div style={line}>Location: <a href={mapUrl(proof.location)} target="_blank" rel="noreferrer" style={{ color: C.torque, fontWeight: 700 }}>open on the map</a>{proof.location.accuracyM ? ` (± ${Math.round(proof.location.accuracyM)} m)` : ""}</div>
            : proof.verified && <div style={{ ...line, color: C.muted }}>Location: not shared by the driver's phone</div>}
          <div style={{ ...body, fontSize: 10.5, color: C.muted, marginTop: 4 }}>Sent {when(proof.photos[0].submittedAt)}</div>
        </div>
      )}
      {list.length > 0 && (
        <div data-testid="delivery-attempts" style={{ marginTop: 8, background: C.redBg, borderRadius: 8, padding: 10 }}>
          <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.red }}>COULDN'T DELIVER ({list.length})</div>
          {list.map((a, i) => (
            <div key={i} style={{ ...line, marginTop: 4 }}>
              <b>{a.reasonText}</b>{a.note ? `: ${a.note}` : ""} · {when(a.createdAt)}{a.driver ? ` · ${[a.driver.name, a.driver.company].filter(Boolean).join(", ")}` : ""}
              {a.location && <> · <a href={mapUrl(a.location)} target="_blank" rel="noreferrer" style={{ color: C.torque }}>map</a></>}
              {a.photoUrl && <> · <a href={`${apiBase}${a.photoUrl}`} target="_blank" rel="noreferrer" style={{ color: C.torque }}>photo</a></>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
