import React, { useEffect, useState } from "react";
import { C, body } from "./theme";
import { Card } from "./components/ui";
import { API_BASE_URL, getStoredToken, SessionExpiredError } from "./auth";

/**
 * PAYMENT TERMS on the admin's supplier page (migration 122): when an order becomes money Leap owes this supplier. Only for a verified
 * supplier. The owed figures (admin Payouts, the supplier's Finance and Overview) follow the term saved here.
 */
export const PAYMENT_TERM_OPTIONS = [
  { value: "before_shipping", label: "Pay before shipping", hint: "Owed as soon as the supplier accepts the order." },
  { value: "hub_arrival", label: "Pay when it arrives at the inspection hub", hint: "Owed when the hub marks the parcel received." },
  { value: "after_delivery", label: "Pay after delivery", hint: "Owed when the parcel is delivered to the buyer." },
  { value: "after_return_window", label: "Pay after the return window", hint: "Owed when the return window has passed after delivery. The default." },
  { value: "days_after_shipping", label: "Pay a set number of days after shipping", hint: "Owed a fixed number of days after the supplier ships to the hub." },
];

async function call(method, supplierId, payload) {
  const res = await fetch(`${API_BASE_URL}/payouts/terms/${encodeURIComponent(supplierId)}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (res.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function SupplierPaymentTermsCard({ supplierId, onSessionExpired }) {
  const [saved, setSaved] = useState(null);
  const [term, setTerm] = useState("after_return_window");
  const [days, setDays] = useState(10);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const fail = (err) => { if (err instanceof SessionExpiredError) return onSessionExpired && onSessionExpired(); setError(err.message); };
  const apply = (d) => { setSaved(d); setTerm(d.paymentTerm); if (d.paymentTermDays) setDays(d.paymentTermDays); };
  useEffect(() => { call("GET", supplierId).then(apply).catch(fail); }, [supplierId]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = saved && (term !== saved.paymentTerm || (term === "days_after_shipping" && Number(days) !== saved.paymentTermDays));
  const daysOk = Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 30;
  const save = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      apply(await call("PUT", supplierId, { paymentTerm: term, ...(term === "days_after_shipping" ? { paymentTermDays: Number(days) } : {}) }));
      setNotice("Saved. The owed amounts now follow these terms.");
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const small = { ...body, fontSize: 11.5, color: C.muted };
  return (
    <div data-testid="payment-terms">
      <Card title="Payment terms">
        <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={small}>When an order becomes money we owe this supplier. A change applies to every order that is not paid yet.</div>
          {saved && !saved.verified && <div style={{ ...body, fontSize: 12.5, color: C.amber, background: C.amberBg, borderRadius: 8, padding: 10 }}>Payment terms can be set once the supplier is verified. Until then: {saved.paymentTermText}.</div>}
          {saved && saved.verified && PAYMENT_TERM_OPTIONS.map((o) => {
            const on = term === o.value;
            return (
              <label key={o.value} data-testid={`term-${o.value}`} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1.5px solid ${on ? C.torque : C.line}`, background: on ? C.torqueBg : "#fff", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                <input type="radio" name={`payment-term-${supplierId}`} checked={on} onChange={() => setTerm(o.value)} style={{ marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink }}>{o.label}</div>
                  <div style={small}>{o.hint}</div>
                  {o.value === "days_after_shipping" && on && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, ...body, fontSize: 12.5 }}>
                      <input aria-label="Days after shipping" type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value === "" ? "" : Number(e.target.value))}
                        style={{ ...body, width: 64, fontSize: 14, fontWeight: 800, padding: "5px 8px", borderRadius: 8, border: `1.5px solid ${daysOk ? C.torque : C.red}` }} />
                      <span>days after the supplier ships to the hub</span><span style={{ color: C.muted }}>(1–30)</span>
                    </div>
                  )}
                </div>
              </label>
            );
          })}
          {error && <div style={{ ...body, fontSize: 12.5, color: C.red }}>{error}</div>}
          {notice && <div style={{ ...body, fontSize: 12.5, color: C.gauge }}>{notice}</div>}
          {saved && saved.verified && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button disabled={!changed || busy} onClick={() => { setTerm(saved.paymentTerm); setDays(saved.paymentTermDays || 10); }} style={{ ...body, padding: "7px 13px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 600, cursor: changed ? "pointer" : "default", opacity: changed ? 1 : 0.5 }}>Cancel</button>
              <button data-testid="save-terms" disabled={!changed || busy || (term === "days_after_shipping" && !daysOk)} onClick={save} style={{ ...body, padding: "7px 13px", borderRadius: 8, border: "none", background: C.signal, color: C.onSignal, fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: !changed || busy ? 0.5 : 1 }}>{busy ? "Saving…" : "Save terms"}</button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
