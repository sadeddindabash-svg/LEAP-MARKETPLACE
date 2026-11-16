import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { C, disp, body } from "./theme";
import { Card } from "./components/ui";
import { getStoredToken, SessionExpiredError, API_BASE_URL } from "./auth";
import { exportToExcel } from "./exportToExcel";
import { shiftDate, money } from "./profitsApi";

// Financial -> Shipping costs (migration 127): what every parcel really cost to ship, as the inspection hub entered it, against the shipping
// already inside its parts' prices (planned). Within +-2% is "equal"; cheaper is "saved" (extra profit); dearer stops the parcel until an admin
// approves it here (extra cost) or sends it back to the hub. Only admins see these amounts.
const PERIODS = [["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"], ["quarter", "Quarterly"], ["year", "Yearly"]];
const num = { ...body, fontVariantNumeric: "tabular-nums" };
const small = { ...body, fontSize: 12.5, color: C.muted };
const button = { ...body, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: "pointer" };
const dark = { ...button, background: C.ink, color: "#fff", borderColor: C.ink };
const photoSrc = (url) => (!url ? null : /^https?:\/\//.test(url) ? url : `${API_BASE_URL}${url}`);
const local = (amount, currency) => `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`);

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}`, ...(options.headers || {}) } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function ResultChip({ p }) {
  const style = (bg, color) => ({ ...body, fontSize: 11, fontWeight: 800, borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap", background: bg, color });
  if (p.state === "needs_photo") return <span style={style(C.amberBg, "#7A5300")}>WAITING FOR THE HUB'S PHOTO</span>;
  if (p.state === "waiting") return <span style={style(C.amberBg, "#7A5300")}>WAITING APPROVAL</span>;
  if (p.state === "sent_back") return <span style={style("#EEEFF1", "#4B5563")}>SENT BACK TO THE HUB</span>;
  if (p.result === "equal") return <span style={style("#EEEFF1", "#4B5563")}>EQUAL</span>;
  if (p.result === "saved") return <span style={style(C.gaugeBg, C.gauge)}>SAVED · {signed(-p.differenceUsd)} PROFIT</span>;
  return <span style={style(C.redBg, C.red)}>OVER · {signed(-(p.differenceUsd ?? 0))}{p.decidedBy ? ` · approved by ${p.decidedBy}` : ""}</span>;
}

function Box({ label, value, tone, children }) {
  const bg = tone === "good" ? C.gaugeBg : tone === "bad" ? C.redBg : C.card;
  return (
    <div style={{ flex: 1, minWidth: 0, background: bg, border: `1px solid ${tone ? "transparent" : C.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ ...body, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ ...disp, fontSize: 24, fontWeight: 800, marginTop: 4, color: tone === "good" ? C.gauge : tone === "bad" ? C.red : tone === "amber" ? C.amber : C.ink }}>{value}</div>
      {children}
    </div>
  );
}

function Photo({ url, label }) {
  if (!url) return <span style={{ ...small, fontSize: 11.5 }}>{label}: none</span>;
  return (
    <a href={photoSrc(url)} target="_blank" rel="noreferrer" title={`${label} (opens full size)`} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3, textDecoration: "none" }}>
      <img src={photoSrc(url)} alt={label} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
      <span style={{ ...body, fontSize: 10.5, color: C.muted }}>{label}</span>
    </a>
  );
}

function Waiting({ p, onDecide, busy }) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <div data-testid="waiting-parcel" style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.3fr) 0.8fr 0.9fr 0.8fr auto minmax(240px, 1.5fr)", gap: 14, alignItems: "center", padding: "14px 18px", borderTop: `1px solid #F0F1F3` }}>
      <div><div style={{ ...body, fontWeight: 800, fontSize: 15 }}>{p.orderId}</div><div style={small}>{[p.hubName, p.carrier, p.weightKg ? `${p.weightKg} kg` : null].filter(Boolean).join(" · ")}</div><div style={{ ...small, fontSize: 11.5 }}>by {p.enteredBy || "the hub"} · {p.enteredDay}</div></div>
      <div><div style={{ ...small, fontSize: 11, fontWeight: 700 }}>PLANNED{p.plannedEstimated ? " ≈" : ""}</div><div style={{ ...num, fontWeight: 800, fontSize: 15 }}>{p.plannedUsd === null ? "unknown" : money(p.plannedUsd)}</div></div>
      <div><div style={{ ...small, fontSize: 11, fontWeight: 700 }}>PAID</div><div style={{ ...num, fontWeight: 800, fontSize: 15 }}>{money(p.paidUsd)}</div><div style={{ ...small, fontSize: 11.5 }}>{local(p.amount, p.currency)}</div></div>
      <div><div style={{ ...small, fontSize: 11, fontWeight: 700 }}>EXTRA COST</div><div style={{ ...num, fontWeight: 800, fontSize: 15, color: C.red }}>{p.differenceUsd === null ? "—" : signed(p.differenceUsd)}</div></div>
      <div style={{ display: "flex", gap: 10 }}><Photo url={p.parcelPhoto} label="Parcel" /><Photo url={p.receiptPhoto} label="Receipt" /></div>
      <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
        {p.state === "needs_photo" && <span style={{ ...small, color: C.amber, fontWeight: 700 }}>The hub has not sent the parcel photo yet.</span>}
        {sending && <input aria-label="Note for the hub" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the hub (optional)" style={{ ...body, width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1px solid ${C.line}`, padding: "7px 10px", fontSize: 12.5 }} />}
        <div style={{ display: "flex", gap: 8 }}>
          {!sending && <button type="button" style={button} disabled={busy} onClick={() => setSending(true)}>Send back</button>}
          {sending && <button type="button" style={button} disabled={busy} onClick={() => setSending(false)}>Cancel</button>}
          {sending && <button type="button" style={dark} disabled={busy} onClick={() => onDecide(p, false, note)}>Send back to the hub</button>}
          {!sending && p.state === "waiting" && <button type="button" style={dark} disabled={busy} onClick={() => onDecide(p, true)}>Approve · ship</button>}
        </div>
      </div>
    </div>
  );
}

export default function ShippingCostsPanel({ onSessionExpired }) {
  const [period, setPeriod] = useState("month");
  const [date, setDate] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true; setError(null);
    api(`/parcel-costs?${new URLSearchParams({ period, ...(date ? { date } : {}) })}`)
      .then((r) => { if (live) setReport(r); })
      .catch((err) => { if (!live) return; if (err instanceof SessionExpiredError) return onSessionExpired?.(); setError(err.message); });
    return () => { live = false; };
  }, [period, date, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (p, approve, note) => {
    setBusy(true); setError(null);
    try { await api(`/parcel-costs/${p.id}/${approve ? "approve" : "send-back"}`, { method: "POST", body: JSON.stringify(approve ? {} : { note }) }); setTick((n) => n + 1); }
    catch (err) { if (err instanceof SessionExpiredError) return onSessionExpired?.(); setError(err.message); }
    finally { setBusy(false); }
  };
  const t = report?.totals;
  const exportRows = () => exportToExcel({
    filename: `shipping-costs-${period}-${report.start}`, sheetName: "Shipping costs",
    columns: [{ header: "Parcel (order)", key: "orderId", width: 16 }, { header: "Date", key: "enteredDay", width: 12 }, { header: "Hub", key: "hubName", width: 18 }, { header: "Carrier", key: "carrier", width: 16 },
      { header: "Weight (kg)", key: "weightKg", width: 12 }, { header: "Planned (USD)", key: "plannedUsd", width: 14 }, { header: "Planned is an estimate", key: "estimated", width: 12 }, { header: "Paid (USD)", key: "paidUsd", width: 12 },
      { header: "Paid", key: "amount", width: 10 }, { header: "Currency", key: "currency", width: 10 }, { header: "Difference (USD)", key: "differenceUsd", width: 16 }, { header: "Result", key: "result", width: 10 },
      { header: "State", key: "state", width: 12 }, { header: "Entered by", key: "enteredBy", width: 18 }, { header: "Decided by", key: "decidedBy", width: 18 }],
    rows: report.parcels.map((p) => ({ ...p, estimated: p.plannedEstimated ? "yes" : "" })),
  });
  const th = { ...body, textAlign: "start", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, padding: "10px 12px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
  const td = { ...body, fontSize: 13, padding: "10px 12px", borderBottom: "1px solid #F0F1F3" };

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      {error && <div role="alert" style={{ ...body, fontSize: 13, color: C.red, background: C.redBg, borderRadius: 8, padding: 12 }}>{error}</div>}
      {report && report.waiting.length > 0 && (
        <Card title={`${report.waiting.length} ${report.waiting.length === 1 ? "parcel waits" : "parcels wait"} for your approval`}>
          <div style={{ ...small, padding: "10px 18px 0" }}>Dearer than the shipping inside its prices by more than {report.tolerancePercent}%: the hub cannot ship it until you approve it. Approve: it ships, and the difference counts as extra cost. Send back: the hub enters the cost again.</div>
          {report.waiting.map((p) => <Waiting key={p.id} p={p} onDecide={decide} busy={busy} />)}
        </Card>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div role="group" aria-label="Period" style={{ display: "inline-flex", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 3 }}>
          {PERIODS.map(([id, name]) => (
            <button key={id} type="button" aria-pressed={period === id} onClick={() => { setPeriod(id); setDate(report?.running ? null : report?.start || null); }}
              style={{ ...body, border: "none", cursor: "pointer", padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: period === id ? C.ink : "transparent", color: period === id ? "#fff" : C.muted }}>{name}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" aria-label="Previous" onClick={() => report && setDate(shiftDate(report.start, period, -1))} style={{ ...button, padding: 7 }}><ChevronLeft size={16} /></button>
          <span style={{ ...button, cursor: "default", minWidth: 200, justifyContent: "center", fontWeight: 700 }}>{report ? `${report.label}${report.running ? " · so far" : ""}` : "…"}</span>
          <button type="button" aria-label="Next" disabled={!report || report.running} onClick={() => report && setDate(shiftDate(report.start, period, 1))} style={{ ...button, padding: 7, opacity: !report || report.running ? 0.4 : 1 }}><ChevronRight size={16} /></button>
          {report && <button type="button" onClick={exportRows} style={button}><Download size={14} /> Export</button>}
        </div>
      </div>

      {report && (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Box label="Parcels" value={t.parcels} />
            <Box label="Planned" value={money(t.plannedUsd)} />
            <Box label="Paid" value={money(t.paidUsd)} />
            <Box label="Shipping result" value={signed(t.shippingResultUsd)} tone={t.shippingResultUsd > 0 ? "good" : t.shippingResultUsd < 0 ? "bad" : undefined}>
              <div style={{ ...small, fontSize: 11.5 }}>{t.saved.parcels} saved {signed(t.saved.usd)} · {t.over.parcels} over {signed(-t.over.usd)}{t.waiting ? ` · ${t.waiting} not decided yet` : ""}</div>
            </Box>
            <Box label="Waiting approval" value={report.waiting.length} tone={report.waiting.length ? "amber" : undefined} />
          </div>
          <Card title="Every parcel">
            {report.parcels.length === 0 ? <div style={{ padding: 24, textAlign: "center", ...small }}>No shipping cost was entered in this period.</div> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Parcel", "Date", "Hub · carrier", "Weight", "Planned", "Paid", "Paid (hub currency)", "Difference", "Result", "Photos"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {report.parcels.map((p) => (
                      <tr key={p.id}>
                        <td style={{ ...td, fontWeight: 800 }}>{p.orderId}</td>
                        <td style={td}>{p.enteredDay}</td>
                        <td style={td}>{[p.hubName, p.carrier].filter(Boolean).join(" · ")}</td>
                        <td style={td}>{p.weightKg ? `${p.weightKg} kg` : "—"}</td>
                        <td style={{ ...td, ...num }}>{p.plannedUsd === null ? "unknown" : `${p.plannedEstimated ? "≈ " : ""}${money(p.plannedUsd)}`}</td>
                        <td style={{ ...td, ...num }}>{money(p.paidUsd)}</td>
                        <td style={{ ...td, ...num, color: C.muted }}>{local(p.amount, p.currency)}</td>
                        <td style={{ ...td, ...num, color: p.differenceUsd > 0 ? C.red : p.differenceUsd < 0 ? C.gauge : C.ink }}>{signed(p.differenceUsd)}</td>
                        <td style={td}><ResultChip p={p} /></td>
                        <td style={td}>{p.receiptPhoto || p.parcelPhoto ? <span style={{ display: "flex", gap: 8 }}>{p.parcelPhoto && <a href={photoSrc(p.parcelPhoto)} target="_blank" rel="noreferrer">Parcel</a>}{p.receiptPhoto && <a href={photoSrc(p.receiptPhoto)} target="_blank" rel="noreferrer">Receipt</a>}</span> : "—"}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...td, fontWeight: 800, borderTop: `2px solid ${C.ink}` }}>Total</td><td style={{ ...td, borderTop: `2px solid ${C.ink}` }} colSpan={3} />
                      <td style={{ ...td, ...num, fontWeight: 800, borderTop: `2px solid ${C.ink}` }}>{money(t.plannedUsd)}</td>
                      <td style={{ ...td, ...num, fontWeight: 800, borderTop: `2px solid ${C.ink}` }}>{money(t.paidUsd)}</td>
                      <td style={{ ...td, borderTop: `2px solid ${C.ink}` }} />
                      <td style={{ ...td, ...num, fontWeight: 800, borderTop: `2px solid ${C.ink}`, color: t.shippingResultUsd > 0 ? C.gauge : t.shippingResultUsd < 0 ? C.red : C.ink }}>{signed(-t.shippingResultUsd)}</td>
                      <td style={{ ...td, borderTop: `2px solid ${C.ink}` }} colSpan={2}><span style={small}>difference: the decided parcels{t.waiting ? ` (${t.waiting} waiting not counted)` : ""}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <div style={{ ...small, fontSize: 12 }}>Planned = the shipping inside the parts' prices when the order was placed (≈: worked out from today's Pricing, for an order placed before costs were kept). Paid is converted to dollars at the rate of the day it was entered. Within ±{report.tolerancePercent}% counts as equal.</div>
        </>
      )}
    </div>
  );
}
