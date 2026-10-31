import React, { useState } from "react";
import { C, body } from "./theme";
import { Th, Td } from "./components/ui";
import { API_BASE_URL, getStoredToken, SessionExpiredError } from "./auth";

/**
 * Admin -> Payouts, "Amount owed" (migration 122). Per supplier: their payment terms, owed now, to recover (paid, then cancelled / refused /
 * returned), what "Record payout" pays now (owed - to recover) and what is not due yet. "Details" lists the orders and why.
 */
const yuan = (n) => `¥${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATE = { owed: ["Owed", C.gauge], recover: ["To recover", C.red], not_due: ["Not due yet", C.amber], on_hold: ["On hold", C.muted] };

export default function OwedSuppliersTable({ owed, payoutMethods, payingSupplierId, onRecord, onSessionExpired }) {
  const [open, setOpen] = useState(null);       // supplierId
  const [details, setDetails] = useState({});   // supplierId -> data | { error }
  const toggle = async (supplierId) => {
    if (open === supplierId) return setOpen(null);
    setOpen(supplierId);
    try {
      const res = await fetch(`${API_BASE_URL}/payouts/owed/${encodeURIComponent(supplierId)}`, { headers: { Authorization: `Bearer ${getStoredToken()}` } });
      if (res.status === 401) throw new SessionExpiredError("expired");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setDetails((d) => ({ ...d, [supplierId]: data }));
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired && onSessionExpired();
      setDetails((d) => ({ ...d, [supplierId]: { error: err.message } }));
    }
  };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr><Th>Supplier</Th><Th>Payment terms</Th><Th align="right">Owed now</Th><Th align="right">To recover</Th><Th align="right">Pay this time</Th><Th align="right">Not due yet</Th><Th>Payout method</Th><Th></Th></tr></thead>
      <tbody>
        {owed.map((o) => {
          const method = payoutMethods[o.supplierId];
          const recover = o.toRecover || { amount: 0, count: 0 };
          const notDue = o.notDue || { amount: 0, count: 0 };
          const payNow = o.payNow !== undefined ? o.payNow : o.amountOwed;
          const cannotPay = payingSupplierId === o.supplierId || !method || !(payNow > 0);
          const d = details[o.supplierId];
          return (
            <React.Fragment key={o.supplierId}>
              <tr data-testid={`owed-row-${o.supplierId}`}>
                <Td style={{ fontWeight: 600 }}>{o.supplierName}</Td>
                <Td style={{ color: C.muted, fontSize: 12 }}>{o.paymentTermText || "—"}</Td>
                <Td align="right">{yuan(o.amountOwed)}<div style={{ ...body, fontSize: 10.5, color: C.muted }}>{o.eligibleSubOrderCount} order{o.eligibleSubOrderCount === 1 ? "" : "s"}</div></Td>
                <Td align="right" style={{ color: recover.amount > 0 ? C.red : C.muted }}>{recover.amount > 0 ? `− ${yuan(recover.amount)}` : "—"}</Td>
                <Td align="right" style={{ fontWeight: 800 }}>{yuan(payNow)}</Td>
                <Td align="right" style={{ color: C.muted }}>{notDue.count > 0 ? <>{yuan(notDue.amount)}<div style={{ fontSize: 10.5 }}>{notDue.count} order{notDue.count === 1 ? "" : "s"}{notDue.nextDueAt ? ` · next ${new Date(notDue.nextDueAt).toLocaleDateString("en-GB")}` : ""}</div></> : "—"}</Td>
                <Td>
                  {method ? (
                    <div style={{ ...body, fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>{method.bankName} — {method.accountNumber}</div>
                      <div style={{ color: C.muted, fontSize: 11 }}>{method.accountHolderName}</div>
                    </div>
                  ) : (
                    <span style={{ ...body, fontSize: 11.5, color: C.red, background: C.redBg, padding: "3px 8px", borderRadius: 6 }}>No payout method on file</span>
                  )}
                </Td>
                <Td align="right" style={{ whiteSpace: "nowrap" }}>
                  <button onClick={() => toggle(o.supplierId)} style={{ ...body, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", marginRight: 6 }}>{open === o.supplierId ? "Hide" : "Details"}</button>
                  <button
                    disabled={cannotPay}
                    onClick={() => onRecord(o.supplierId)}
                    title={!method ? "This supplier has no payout method on file yet" : !(payNow > 0) ? "Nothing to pay this time" : undefined}
                    style={{ ...body, padding: "7px 14px", borderRadius: 8, border: "none", background: cannotPay ? "#D1D5DB" : C.gauge, color: "#fff", fontSize: 12, fontWeight: 700, cursor: cannotPay ? "default" : "pointer" }}
                  >{payingSupplierId === o.supplierId ? "Recording…" : "Record payout"}</button>
                </Td>
              </tr>
              {open === o.supplierId && (
                <tr><td colSpan={8} style={{ padding: "0 12px 12px" }}>
                  <div data-testid={`owed-details-${o.supplierId}`} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, background: "#FAFBFC" }}>
                    {!d && <div style={{ ...body, fontSize: 12, color: C.muted }}>Loading…</div>}
                    {d && d.error && <div style={{ ...body, fontSize: 12, color: C.red }}>{d.error}</div>}
                    {d && d.orders && (d.orders.length === 0 ? <div style={{ ...body, fontSize: 12, color: C.muted }}>No open orders.</div> : (
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><Th>Order</Th><Th>State</Th><Th>Why</Th><Th>Due</Th><Th align="right">Amount</Th></tr></thead>
                        <tbody>
                          {d.orders.map((r) => (
                            <tr key={r.subOrderId}>
                              <Td style={{ fontWeight: 600 }}>{r.orderId}</Td>
                              <Td style={{ color: (STATE[r.state] || [])[1], fontWeight: 700 }}>{(STATE[r.state] || [r.state])[0]}</Td>
                              <Td style={{ color: C.muted, fontSize: 12 }}>{r.reason}</Td>
                              <Td style={{ color: C.muted, fontSize: 12 }}>{r.dueAt ? new Date(r.dueAt).toLocaleDateString("en-GB") : "—"}</Td>
                              <Td align="right" style={{ color: r.state === "recover" ? C.red : C.ink }}>{r.state === "recover" ? `− ${yuan(r.amount)}` : yuan(r.amount)}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ))}
                  </div>
                </td></tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
