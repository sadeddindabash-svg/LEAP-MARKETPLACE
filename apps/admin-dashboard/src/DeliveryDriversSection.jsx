import React, { useEffect, useState } from "react";
import { C, body } from "./theme";
import { Card } from "./components/ui";
import { API_BASE_URL, getStoredToken, SessionExpiredError } from "./auth";

/**
 * Delivery drivers of the local delivery partner (migration 120), on the Hubs page under "Hub staff". Only these drivers can confirm a delivery
 * on the page the label's QR opens (with the buyer's code). Same rules as hub staff: the server makes the temporary password and it is shown
 * ONCE here; drivers are turned off, never deleted; turning one off stops them at once; a password reset signs them out everywhere.
 */
async function call(method, path, body) {
  const res = await fetch(`${API_BASE_URL}/delivery-drivers${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const EMPTY = { name: "", phone: "", company: "" };

export default function DeliveryDriversSection({ onSessionExpired }) {
  const [drivers, setDrivers] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);      // null | { id?, name, phone, company }
  const [reveal, setReveal] = useState(null);  // { driver, temporaryPassword }
  const [busy, setBusy] = useState(false);

  const fail = (err) => { if (err instanceof SessionExpiredError) return onSessionExpired && onSessionExpired(); setError(err.message); };
  const load = () => call("GET", "").then((d) => { setDrivers(Array.isArray(d) ? d : []); setError(null); }).catch(fail);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => { setBusy(true); try { await fn(); } catch (err) { fail(err); } finally { setBusy(false); } };
  const save = () => run(async () => {
    const payload = { name: form.name, phone: form.phone, company: form.company };
    if (form.id) { await call("PATCH", `/${form.id}`, payload); }
    else { const r = await call("POST", "", payload); setReveal({ driver: r.driver, temporaryPassword: r.temporaryPassword }); }
    setForm(null); await load();
  });
  const toggle = (d) => run(async () => { await call("POST", `/${d.id}/${d.isDisabled ? "enable" : "disable"}`); await load(); });
  const reset = (d) => {
    if (!window.confirm(`Make a new password for ${d.name}? Their old password and every sign-in they have stop working.`)) return;
    run(async () => { const r = await call("POST", `/${d.id}/reset-password`); setReveal({ driver: d, temporaryPassword: r.temporaryPassword }); });
  };

  const input = { ...body, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.line}`, width: "100%", boxSizing: "border-box" };
  const small = { ...body, fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 7, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, cursor: "pointer" };
  const primary = { ...body, padding: "7px 13px", borderRadius: 8, border: "none", background: C.signal, color: C.onSignal, fontSize: 12.5, fontWeight: 700, cursor: "pointer" };

  return (
    <div data-testid="delivery-drivers" style={{ marginTop: 16 }}>
      <Card title="Delivery drivers" action={<button style={primary} onClick={() => { setError(null); setForm({ ...EMPTY }); }}>+ Add driver</button>}>
        <div style={{ padding: "12px 18px" }}>
          <div style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 10 }}>
            Drivers of your delivery partner. They scan the QR on the parcel's label, sign in with their phone number, and confirm the delivery with a photo and the buyer's 4-digit code.
          </div>
          {error && <div style={{ ...body, fontSize: 12.5, color: C.red, marginBottom: 8 }}>{error}</div>}
          {reveal && (
            <div data-testid="driver-password" style={{ background: C.amberBg, borderRadius: 8, padding: 12, marginBottom: 10, ...body, fontSize: 12.5 }}>
              Password for <b>{reveal.driver.name}</b> (sign in with <b>{reveal.driver.phone}</b>): <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 800 }}>{reveal.temporaryPassword}</span>
              <div style={{ color: C.muted, marginTop: 4 }}>Shown only now. Give it to the driver; it can't be seen again (use "New password" if it is lost).</div>
              <button style={{ ...small, marginTop: 8 }} onClick={() => setReveal(null)}>Done</button>
            </div>
          )}
          {form && (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <label style={{ ...body, fontSize: 11.5, color: C.muted }}>Name<input aria-label="Driver name" style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label style={{ ...body, fontSize: 11.5, color: C.muted }}>Phone (to sign in)<input aria-label="Driver phone" style={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+9665…" /></label>
              <label style={{ ...body, fontSize: 11.5, color: C.muted }}>Delivery company<input aria-label="Delivery company" style={input} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={primary} disabled={busy} onClick={save}>{form.id ? "Save" : "Create"}</button>
                <button style={small} onClick={() => setForm(null)}>Cancel</button>
              </div>
            </div>
          )}
          {drivers === null && !error && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
          {drivers && drivers.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>No drivers yet.</div>}
          {drivers && drivers.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", ...body, fontSize: 12.5 }}>
              <thead><tr style={{ color: C.muted, textAlign: "left" }}><th style={{ padding: 6 }}>Driver</th><th style={{ padding: 6 }}>Phone</th><th style={{ padding: 6 }}>Company</th><th style={{ padding: 6 }}>Deliveries</th><th style={{ padding: 6 }}>Last delivery</th><th style={{ padding: 6 }}>Status</th><th /></tr></thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id} data-testid={`driver-row-${d.id}`} style={{ borderTop: `1px solid ${C.line}`, opacity: d.isDisabled ? 0.6 : 1 }}>
                    <td style={{ padding: 6, fontWeight: 700 }}>{d.name}</td>
                    <td style={{ padding: 6 }}>{d.phone}</td>
                    <td style={{ padding: 6 }}>{d.company}</td>
                    <td style={{ padding: 6 }}>{d.deliveries}</td>
                    <td style={{ padding: 6 }}>{d.lastDeliveryAt ? new Date(d.lastDeliveryAt).toLocaleDateString("en-GB") : "—"}</td>
                    <td style={{ padding: 6, color: d.isDisabled ? C.red : C.gauge, fontWeight: 700 }}>{d.isDisabled ? "Off" : "Active"}</td>
                    <td style={{ padding: 6, whiteSpace: "nowrap", textAlign: "right" }}>
                      <button style={small} disabled={busy} onClick={() => setForm({ id: d.id, name: d.name, phone: d.phone, company: d.company })}>Edit</button>{" "}
                      <button style={small} disabled={busy} onClick={() => reset(d)}>New password</button>{" "}
                      <button style={{ ...small, color: d.isDisabled ? C.gauge : C.red }} disabled={busy} onClick={() => toggle(d)}>{d.isDisabled ? "Turn on" : "Turn off"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
