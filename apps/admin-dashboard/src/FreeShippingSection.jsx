import React, { useState, useEffect } from "react";
import { C, body } from "./theme";
import { Card } from "./components/ui";
import { SessionExpiredError, getStoredToken } from "./auth";
import { fetchFreeShippingAdmin, saveFreeShipping } from "./freeShippingApi";

// "Free shipping": orders whose goods (after any discount) come to the limit or more ship free; under it the buyer pays the shipping fee on top. Switched off (the default) shipping is always free, as it always was. Amounts are in US dollars:
// buyers see them in their own currency. It applies to NEW orders only; an order keeps the shipping fee it was charged. The server checks everything again (services/api/src/modules/platform-settings/freeShipping.js).
const money = (n) => `$${Number(n).toFixed(2)}`;
const FALLBACK_LIMITS = { maxThresholdUsd: 100000, maxFeeUsd: 10000 };

/** Reads an amount typed by the admin: whole dollars or with up to two decimals. Returns { value } or { problem }. */
export function readAmount(text, max, what) {
  const t = String(text).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { problem: `${what}: enter an amount like 50 or 50.00` };
  const value = Number(t);
  if (value > max) return { problem: `${what} cannot be more than ${max}` };
  return { value };
}
/** What the two typed amounts mean with the switch on or off: { limit, fee, problems: { limit?, fee? } }. With the switch on both must be above 0. */
export function checkAmounts(enabled, limitText, feeText, limits = FALLBACK_LIMITS) {
  const problems = {}; const limit = readAmount(limitText, limits.maxThresholdUsd, "The free-shipping limit"); const fee = readAmount(feeText, limits.maxFeeUsd, "The shipping fee");
  if (limit.problem) problems.limit = limit.problem; else if (enabled && limit.value <= 0) problems.limit = "Enter a free-shipping limit above 0, or switch shipping fees off";
  if (fee.problem) problems.fee = fee.problem; else if (enabled && fee.value <= 0) problems.fee = "Enter a shipping fee above 0, or switch shipping fees off";
  return { limit: limit.value ?? null, fee: fee.value ?? null, problems };
}
/** The sentence under the fields: what a small basket and a basket at the limit pay. */
export function previewText(enabled, limit, fee) {
  if (!enabled) return "Shipping fees are off: shipping is always free.";
  const small = limit / 2;
  return `A basket of ${money(small)} pays ${money(fee)} shipping (total ${money(small + fee)}). A basket of ${money(limit)} or more ships free.`;
}

const input = { ...body, width: 120, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 };
const label = { ...body, display: "block", fontSize: 13, fontWeight: 600, color: C.ink, margin: "0 0 6px" };
const note = { ...body, fontSize: 12, color: C.muted };

export default function FreeShippingSection({ onSessionExpired }) {
  const [loadState, setLoadState] = useState("loading");
  const [saved, setSaved] = useState(null);                  // what the server stores: { enabled, thresholdUsd, feeUsd, limits }
  const [enabled, setEnabled] = useState(false);
  const [limitText, setLimitText] = useState("");
  const [feeText, setFeeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const adopt = (data) => { setSaved(data); setEnabled(Boolean(data.enabled)); setLimitText(Number(data.thresholdUsd).toFixed(2)); setFeeText(Number(data.feeUsd).toFixed(2)); };
  const load = () => {
    setLoadState("loading"); setError(null);
    fetchFreeShippingAdmin(getStoredToken())
      .then((data) => { adopt(data); setLoadState("ready"); })
      .catch((err) => { if (err instanceof SessionExpiredError) return onSessionExpired && onSessionExpired(); setError(err.message); setLoadState("error"); });
  };
  useEffect(() => { let active = true; fetchFreeShippingAdmin(getStoredToken()).then((data) => { if (active) { adopt(data); setLoadState("ready"); } }).catch((err) => { if (!active) return; if (err instanceof SessionExpiredError) return onSessionExpired && onSessionExpired(); setError(err.message); setLoadState("error"); }); return () => { active = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checked = checkAmounts(enabled, limitText, feeText, (saved && saved.limits) || undefined);
  const invalid = Boolean(checked.problems.limit || checked.problems.fee);
  const changed = saved ? enabled !== Boolean(saved.enabled) || checked.limit !== Number(saved.thresholdUsd) || checked.fee !== Number(saved.feeUsd) : false;
  const edit = (setter) => (e) => { setter(e.target.value); setMessage(null); setError(null); };
  const save = async () => {
    if (busy || invalid || !changed) return;
    setBusy(true); setError(null); setMessage(null);
    try { adopt(await saveFreeShipping(getStoredToken(), { enabled, thresholdUsd: checked.limit, feeUsd: checked.fee })); setMessage("Saved."); }
    catch (err) { if (err instanceof SessionExpiredError) return onSessionExpired && onSessionExpired(); setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Free shipping" style={{ flex: 1, minWidth: 420 }}>
      <div style={{ padding: 20 }}>
        <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.45 }}>
          Orders whose goods total reaches the limit ship free. Below it, the buyer pays the shipping fee. One limit for every country; amounts are in US dollars and buyers see them in their own currency.
        </div>
        {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
        {loadState === "error" && (
          <div>
            <div role="alert" style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 10 }}>{error}</div>
            <button type="button" onClick={load} style={{ ...body, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, background: "#fff", cursor: "pointer" }}>Try again</button>
          </div>
        )}
        {loadState === "ready" && (
          <div>
            <label style={{ ...body, display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.ink, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" role="switch" aria-label="Charge a shipping fee on small orders" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setMessage(null); setError(null); }} />
              <span>Charge a shipping fee on small orders <span style={{ color: C.muted }}>(off = shipping is always free, as today)</span></span>
            </label>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <label htmlFor="free-shipping-limit" style={label}>Free shipping from</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input id="free-shipping-limit" inputMode="decimal" value={limitText} onChange={edit(setLimitText)} aria-invalid={Boolean(checked.problems.limit)} style={input} />
                  <span style={note}>USD, on the order total after discounts</span>
                </div>
                {checked.problems.limit && <div role="alert" style={{ ...body, fontSize: 12, color: C.red, marginTop: 6 }}>{checked.problems.limit}</div>}
              </div>
              <div>
                <label htmlFor="free-shipping-fee" style={label}>Shipping fee below the limit</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input id="free-shipping-fee" inputMode="decimal" value={feeText} onChange={edit(setFeeText)} aria-invalid={Boolean(checked.problems.fee)} style={input} />
                  <span style={note}>USD</span>
                </div>
                {checked.problems.fee && <div role="alert" style={{ ...body, fontSize: 12, color: C.red, marginTop: 6 }}>{checked.problems.fee}</div>}
              </div>
            </div>
            <div data-testid="free-shipping-preview" style={{ ...body, fontSize: 12.5, color: C.ink, background: "#F4F6F8", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14, lineHeight: 1.5 }}>
              <b>Preview.</b> {invalid ? "Fix the amounts above to see it." : previewText(enabled, checked.limit, checked.fee)}
            </div>
            {error && <div role="alert" style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button type="button" onClick={save} disabled={busy || invalid || !changed} style={{ ...body, background: "#14212B", color: "#fff", border: 0, borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: busy || invalid || !changed ? "default" : "pointer", opacity: busy || invalid || !changed ? 0.5 : 1 }}>{busy ? "Saving…" : "Save"}</button>
              {message && <span role="status" style={{ ...body, fontSize: 12, color: C.gauge }}>{message}</span>}
              <span style={note}>Applies to new orders only. Orders already placed keep the shipping they were charged.</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
