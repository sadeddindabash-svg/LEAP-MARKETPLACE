import React, { useState, useEffect, useCallback } from "react";
import { X, Trash2, EyeOff } from "lucide-react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken, checkProductDelete, deleteProducts, bulkModerateProducts, sendProductsToReview } from "./auth";

// Admin > All products > Delete. A window that first CHECKS (nothing is changed) which of the chosen products can be deleted and which cannot (an order or a quote request still points at them: their history keeps them), says what goes
// with the ones that can, and offers to HIDE the others instead (Reject: they stay in the database but shoppers no longer see them). One product needs one click; several at once need the typed sentence. No Undo.
export const DELETE_PHRASE = "DELETE PRODUCTS";
const SHOWN = 8;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const button = (primary, danger) => ({ ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: danger ? "#B42318" : primary ? C.ink : C.line, background: danger ? "#B42318" : primary ? C.ink : "#fff", color: danger || primary ? "#fff" : C.ink });
const names = (list) => (list.length <= SHOWN ? list : list.slice(0, SHOWN)).map((p) => p.name).join(", ") + (list.length > SHOWN ? ` and ${list.length - SHOWN} more` : "");

export default function ProductDeleteDialog({ ids, onClose, onChanged, onSessionExpired }) {
  const [phase, setPhase] = useState("checking");          // checking | ready | deleting | done
  const [plan, setPlan] = useState(null); const [result, setResult] = useState(null); const [typed, setTyped] = useState(""); const [error, setError] = useState(null);
  const [hiding, setHiding] = useState(false); const [hidden, setHidden] = useState(null);
  const fail = (err) => { if (err instanceof SessionExpiredError) { onSessionExpired?.(); return true; } setError(err.message); return false; };
  const check = async () => { setPhase("checking"); setError(null); try { setPlan(await checkProductDelete(getStoredToken(), ids)); setPhase("ready"); } catch (err) { fail(err); setPhase("ready"); } };
  useEffect(() => { check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deletable = plan ? plan.deletable : []; const held = plan ? plan.held : []; const needsPhrase = deletable.length > 1;
  const canDelete = deletable.length > 0 && phase === "ready" && (!needsPhrase || typed === DELETE_PHRASE);
  const remove = async () => {
    setPhase("deleting"); setError(null);
    try { const r = await deleteProducts(getStoredToken(), deletable.map((p) => p.id), needsPhrase ? typed : true); setResult(r); setPhase("done"); if (r.deleted.length > 0) onChanged?.("deleted"); }
    catch (err) { setPhase("ready"); fail(err); }
  };
  const hideThem = async () => {
    const targets = held.filter((p) => p.status !== "inactive"); setHiding(true); setError(null);
    try { const { results } = await bulkModerateProducts(getStoredToken(), targets.map((p) => ({ productId: p.id, action: "reject" }))); const ok = results.filter((r) => r.success).length; setHidden(ok); if (ok > 0) onChanged?.("hidden"); }
    catch (err) { fail(err); } finally { setHiding(false); }
  };
  const hideable = held.filter((p) => p.status !== "inactive").length;
  return (
    <div role="dialog" aria-modal="true" aria-label={ids.length === 1 ? "Delete this product" : `Delete ${ids.length} products`} style={{ position: "fixed", inset: 0, background: "rgba(10,20,30,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 560, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ ...body, fontSize: 15, fontWeight: 700, color: C.ink, margin: 0, display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={16} /> {ids.length === 1 ? "Delete this product" : `Delete ${ids.length} products`}</h3>
          <button type="button" aria-label="Close window" style={{ ...button(false), padding: 4, borderWidth: 0 }} onClick={onClose}><X size={16} /></button>
        </div>
        {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, marginBottom: 10 }}>{error}</div>}
        {phase === "checking" && <div style={{ ...body, fontSize: 13, color: C.muted }}>Checking what can be deleted…</div>}
        {(phase === "ready" || phase === "deleting") && plan && (
          <div style={{ ...body, fontSize: 13, color: C.ink, lineHeight: 1.55 }}>
            {deletable.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <b>{plural(deletable.length, "product", "products")} will be deleted:</b> {names(deletable)}.
                {plan.alsoRemoved.length > 0 && <div style={{ color: C.muted }}>This also removes: {plan.alsoRemoved.map((x) => `${x.count} ${x.what}`).join(", ")}.</div>}
                <div style={{ color: "#B42318", fontWeight: 600, marginTop: 4 }}>This cannot be undone.</div>
              </div>
            )}
            {held.length > 0 && (
              <div style={{ marginBottom: 12, background: "#FDF3E1", borderRadius: 8, padding: 10 }}>
                <b>{plural(held.length, "product cannot", "products cannot")} be deleted:</b>
                <ul style={{ margin: "4px 0 6px", paddingInlineStart: 20 }}>{held.map((p) => <li key={p.id}>{p.name}: <span style={{ color: C.muted }}>{p.reason}</span>{p.status === "inactive" ? " (already hidden)" : ""}</li>)}</ul>
                {hidden !== null ? <div role="status" style={{ color: "#16794F", fontWeight: 600 }}>{plural(hidden, "product is", "products are")} now hidden from shoppers.</div>
                  : hideable > 0 ? <button type="button" style={{ ...button(false), display: "inline-flex", gap: 6, alignItems: "center" }} disabled={hiding} onClick={hideThem}><EyeOff size={13} /> {hiding ? "Hiding…" : `Hide ${hideable === 1 ? "it" : "them"} instead`}</button> : null}
                <div style={{ color: C.muted, marginTop: 4 }}>Hiding keeps the product and its history, but shoppers no longer see it. You find it again under “Hidden products” in the product list, and can send it back to review from there.</div>
              </div>
            )}
            {plan.missing.length > 0 && <div style={{ color: C.muted, marginBottom: 10 }}>{plural(plan.missing.length, "product was", "products were")} not found (already deleted?).</div>}
            {deletable.length === 0 && held.length === 0 && plan.missing.length === 0 && <div>Nothing to delete.</div>}
            {needsPhrase && <label style={{ display: "block", marginBottom: 12 }}>To delete several products at once, type <code>{DELETE_PHRASE}</code>:<br /><input aria-label="Type to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type ${DELETE_PHRASE}`} style={{ ...body, fontSize: 13, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, width: 260, marginTop: 4 }} /></label>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" style={button(false)} onClick={onClose} disabled={phase === "deleting"}>{deletable.length === 0 ? "Close" : "Cancel"}</button>
              {deletable.length > 0 && <button type="button" style={button(false, true)} disabled={!canDelete} onClick={remove}>{phase === "deleting" ? "Deleting…" : `Delete ${plural(deletable.length, "product", "products")}`}</button>}
            </div>
          </div>
        )}
        {phase === "done" && result && (
          <div style={{ ...body, fontSize: 13, color: C.ink, lineHeight: 1.55 }}>
            <div role="status" style={{ color: result.deleted.length ? "#16794F" : C.ink, fontWeight: 700, marginBottom: 6 }}>{result.deleted.length === 0 ? "Nothing was deleted." : `${plural(result.deleted.length, "product was", "products were")} deleted.`}{result.picturesRemoved > 0 ? ` ${plural(result.picturesRemoved, "picture", "pictures")} removed from the server.` : ""}</div>
            {result.kept.length > 0 && <div style={{ background: "#FDF3E1", borderRadius: 8, padding: 10, marginBottom: 10 }}><b>{plural(result.kept.length, "product stays", "products stay")}:</b><ul style={{ margin: "4px 0 0", paddingInlineStart: 20 }}>{result.kept.map((p) => <li key={p.id}>{p.name}: <span style={{ color: C.muted }}>{p.reason}</span></li>)}</ul></div>}
            <div style={{ textAlign: "end" }}><button type="button" style={button(true)} onClick={onClose}>Close</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The bar above the product list when some products are ticked. */
export function ProductSelectionBar({ count, onDelete, onClear, onReview }) {
  if (count === 0) return null;
  return (
    <div role="toolbar" aria-label="Selected products" style={{ ...body, display: "flex", gap: 10, alignItems: "center", background: C.canvas, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>
      <b>{count} selected</b>
      {onReview && <button type="button" style={button(true)} onClick={onReview}>Send back to review</button>}
      <button type="button" style={{ ...button(false, true), display: "inline-flex", gap: 6, alignItems: "center" }} onClick={onDelete}><Trash2 size={13} /> Delete…</button>
      <button type="button" style={button(false)} onClick={onClear}>Clear selection</button>
    </div>
  );
}

/** Which products are ticked in the list (kept across pages until cleared). */
export function useProductSelection() {
  const [picked, setPicked] = useState(() => new Set());
  const toggle = useCallback((id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const toggleAll = useCallback((ids) => setPicked((s) => { const all = ids.length > 0 && ids.every((id) => s.has(id)); const n = new Set(s); for (const id of ids) { if (all) n.delete(id); else n.add(id); } return n; }), []);
  const clear = useCallback(() => setPicked(new Set()), []);
  return { picked, toggle, toggleAll, clear };
}
/** The tick of one row (a click on it never opens the product), and the tick in the header that ticks every product of the page. */
export function SelectBox({ id, name, picked, onToggle }) {
  return <input type="checkbox" aria-label={`Select ${name}`} checked={picked.has(id)} onChange={() => onToggle(id)} onClick={(e) => e.stopPropagation()} />;
}
export function SelectAllBox({ ids, picked, onToggleAll }) {
  return <input type="checkbox" aria-label="Select all products on this page" checked={ids.length > 0 && ids.every((id) => picked.has(id))} disabled={ids.length === 0} onChange={() => onToggleAll(ids)} />;
}

/** Live products or Hidden products (the ones that were hidden: they leave every other list, so this is where they are found again). */
export function ProductViewSwitch({ view, onChange }) {
  const tab = (id, label) => <button type="button" aria-pressed={view === id} onClick={() => view !== id && onChange(id)} style={{ ...button(view === id), borderRadius: 99, padding: "5px 14px" }}>{label}</button>;
  return <div role="group" aria-label="Which products" style={{ display: "flex", gap: 8, marginBottom: 12 }}>{tab("live", "Live products")}{tab("hidden", "Hidden products")}</div>;
}
/** Sends hidden products back to the moderation queue (never straight to live: a product that was rejected for bad text must pass the review again). */
export function ProductReviewDialog({ ids, onClose, onChanged, onSessionExpired }) {
  const [phase, setPhase] = useState("asking"); const [result, setResult] = useState(null); const [error, setError] = useState(null);
  const send = async () => {
    setPhase("sending"); setError(null);
    try { const r = await sendProductsToReview(getStoredToken(), ids); setResult(r); setPhase("done"); if (r.sent.length > 0) onChanged?.("reviewed"); }
    catch (err) { setPhase("asking"); if (err instanceof SessionExpiredError) onSessionExpired?.(); else setError(err.message); }
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Send back to review" style={{ position: "fixed", inset: 0, background: "rgba(10,20,30,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 460, maxWidth: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", ...body, fontSize: 13, color: C.ink, lineHeight: 1.55 }}>
        <h3 style={{ ...body, fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Send back to review</h3>
        {error && <div role="alert" style={{ color: C.red, marginBottom: 10 }}>{error}</div>}
        {phase !== "done" ? (
          <>
            <p style={{ margin: "0 0 12px" }}>{plural(ids.length, "hidden product goes", "hidden products go")} back to the <b>Moderation</b> queue, where you check {ids.length === 1 ? "it" : "them"} and approve {ids.length === 1 ? "it" : "them"} again. It is <b>not</b> shown to shoppers until you approve it.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" style={button(false)} onClick={onClose} disabled={phase === "sending"}>Cancel</button><button type="button" style={button(true)} onClick={send} disabled={phase === "sending"}>{phase === "sending" ? "Sending…" : "Send back to review"}</button></div>
          </>
        ) : (
          <>
            <div role="status" style={{ color: result.sent.length ? "#16794F" : C.ink, fontWeight: 700, marginBottom: 6 }}>{result.sent.length === 0 ? "Nothing was sent." : `${plural(result.sent.length, "product is", "products are")} now waiting in Moderation.`}</div>
            {result.skipped.length > 0 && <div style={{ color: C.muted, marginBottom: 6 }}>{plural(result.skipped.length, "product was", "products were")} left as they are (not hidden, or not found).</div>}
            <div style={{ textAlign: "end" }}><button type="button" style={button(true)} onClick={onClose}>Close</button></div>
          </>
        )}
      </div>
    </div>
  );
}

/** On a product's own page: the Delete button and its window. After a deletion, closing the window goes back to the list (the product is gone). */
export function ProductPageDelete({ productId, onBack, onSessionExpired }) {
  const [open, setOpen] = useState(false); const [wasDeleted, setWasDeleted] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ ...button(false), color: "#B42318", borderColor: "#B42318" }}>Delete this product</button>
      {open && <ProductDeleteDialog ids={[productId]} onClose={() => { setOpen(false); if (wasDeleted) onBack(); }} onChanged={(kind) => { if (kind === "deleted") setWasDeleted(true); }} onSessionExpired={onSessionExpired} />}
    </>
  );
}
