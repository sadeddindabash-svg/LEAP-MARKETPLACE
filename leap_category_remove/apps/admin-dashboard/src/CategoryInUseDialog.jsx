import React, { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken, fetchCategoryInUse, removeCategoryWithProducts } from "./auth";

// Categories > delete > "Cannot delete this category - real products still reference it". This window says exactly WHAT still uses the category (including what no product list shows: hidden products, products waiting for review,
// suppliers' unfinished drafts), which of those can be deleted and which cannot (an order or a quote request still points at them), and lets you delete the ones that can, with the category, in one step. No Undo.
export const REMOVE_PHRASE = "DELETE CATEGORY";
const SHOWN = 8;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const button = (primary, danger) => ({ ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: danger ? "#B42318" : primary ? C.ink : C.line, background: danger ? "#B42318" : primary ? C.ink : "#fff", color: danger || primary ? "#fff" : C.ink });
const list = (items) => (items.length <= SHOWN ? items : items.slice(0, SHOWN)).map((p) => p.name).join(", ") + (items.length > SHOWN ? ` and ${items.length - SHOWN} more` : "");

export default function CategoryInUseDialog({ categoryId, categoryName, onClose, onChanged, onSessionExpired }) {
  const [phase, setPhase] = useState("loading");          // loading | ready | removing | done
  const [info, setInfo] = useState(null); const [result, setResult] = useState(null); const [typed, setTyped] = useState(""); const [error, setError] = useState(null);
  const fail = (err) => { if (err instanceof SessionExpiredError) { onSessionExpired?.(); return; } setError(err.message); };
  useEffect(() => { fetchCategoryInUse(getStoredToken(), categoryId).then((d) => { setInfo(d); setPhase("ready"); }).catch((e) => { fail(e); setPhase("ready"); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = async () => {
    setPhase("removing"); setError(null);
    try { const r = await removeCategoryWithProducts(getStoredToken(), categoryId, typed); setResult(r); setPhase("done"); if (r.removedProducts > 0 || r.removedSubCategories > 0 || r.categoryRemoved) onChanged?.(); }
    catch (err) { setPhase("ready"); fail(err); }
  };
  const name = info ? info.category.name : categoryName;
  const states = info ? Object.entries(info.byState).filter(([, n]) => n > 0).map(([label, n]) => `${n} ${label}`).join(", ") : "";
  const hidden = info ? info.byState.hidden + info.byState["waiting for review"] + info.byState["supplier drafts"] : 0;
  const nothingToDo = info && info.deletable === 0 && info.parts === 0 && info.heldTotal > 0;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Delete the category ${name}`} style={{ position: "fixed", inset: 0, background: "rgba(10,20,30,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 580, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", ...body, fontSize: 13, color: C.ink, lineHeight: 1.55 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ ...body, fontSize: 15, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={16} /> Delete “{name}”</h3>
          <button type="button" aria-label="Close window" style={{ ...button(false), padding: 4, borderWidth: 0 }} onClick={onClose}><X size={16} /></button>
        </div>
        {error && <div role="alert" style={{ color: C.red, marginBottom: 10 }}>{error}</div>}
        {phase === "loading" && <div style={{ color: C.muted }}>Looking at what still uses this category…</div>}
        {(phase === "ready" || phase === "removing") && info && (
          <>
            {info.total > 0 ? (
              <p style={{ margin: "0 0 10px" }}><b>{plural(info.total, "product", "products")}</b> still {info.total === 1 ? "uses" : "use"} this category: {states}.{hidden > 0 && <span style={{ color: C.muted }}> Hidden products, products waiting for review and suppliers' drafts do not appear in the product list, but they still count.</span>}</p>
            ) : <p style={{ margin: "0 0 10px" }}>No product uses this category{info.parts > 0 ? `, but it still has ${plural(info.parts, "sub-category", "sub-categories")}` : ""}.</p>}
            {info.deletable > 0 && (
              <div style={{ marginBottom: 10 }}>
                <b>{plural(info.deletable, "product can", "products can")} be deleted:</b> {list(info.sample)}.
                {info.alsoRemoved.length > 0 && <div style={{ color: C.muted }}>This also removes: {info.alsoRemoved.map((x) => `${x.count} ${x.what}`).join(", ")}.</div>}
              </div>
            )}
            {info.heldTotal > 0 && (
              <div style={{ marginBottom: 10, background: "#FDF3E1", borderRadius: 8, padding: 10 }}>
                <b>{plural(info.heldTotal, "product cannot", "products cannot")} be deleted</b> ({info.heldTotal === 1 ? "its history keeps it" : "their history keeps them"}):
                <ul style={{ margin: "4px 0 6px", paddingInlineStart: 20 }}>{info.held.map((p) => <li key={p.id}>{p.name}: <span style={{ color: C.muted }}>{p.reason}</span></li>)}</ul>
                <b>So this category cannot be deleted completely while {info.heldTotal === 1 ? "it exists" : "they exist"}.</b> The others can still be cleared out.
              </div>
            )}
            {nothingToDo && <p style={{ margin: "0 0 10px" }}>There is nothing here that can be deleted.</p>}
            {(info.deletable > 0 || (info.total === 0 && info.parts > 0)) && (
              <>
                <div style={{ color: "#B42318", fontWeight: 600, marginBottom: 8 }}>This cannot be undone.</div>
                <label style={{ display: "block", marginBottom: 12 }}>To go ahead, type <code>{REMOVE_PHRASE}</code>:<br /><input aria-label="Type to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type ${REMOVE_PHRASE}`} style={{ ...body, fontSize: 13, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, width: 260, marginTop: 4 }} /></label>
              </>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" style={button(false)} onClick={onClose} disabled={phase === "removing"}>{nothingToDo || (info.deletable === 0 && info.parts === 0) ? "Close" : "Cancel"}</button>
              {(info.deletable > 0 || (info.total === 0 && info.parts > 0)) && <button type="button" style={button(false, true)} disabled={typed !== REMOVE_PHRASE || phase === "removing"} onClick={remove}>{phase === "removing" ? "Deleting…" : info.heldTotal > 0 ? `Delete the ${plural(info.deletable, "product", "products")} that can go` : info.total > 0 ? `Delete ${plural(info.total, "product", "products")} and the category` : "Delete the category"}</button>}
            </div>
          </>
        )}
        {phase === "done" && result && (
          <>
            <div role="status" style={{ color: result.categoryRemoved ? "#16794F" : C.ink, fontWeight: 700, marginBottom: 8 }}>
              {plural(result.removedProducts, "product was", "products were")} deleted{result.removedSubCategories > 0 ? `, ${plural(result.removedSubCategories, "sub-category", "sub-categories")}` : ""}.{result.picturesRemoved > 0 ? ` ${plural(result.picturesRemoved, "picture", "pictures")} removed from the server.` : ""} {result.categoryRemoved ? "The category was deleted." : "The category stays."}
            </div>
            {result.kept.category && <div style={{ background: "#FDF3E1", borderRadius: 8, padding: 10, marginBottom: 10 }}>The category stays: {result.kept.category}.{result.kept.products.length > 0 && <ul style={{ margin: "4px 0 0", paddingInlineStart: 20 }}>{result.kept.products.map((p) => <li key={p.id}>{p.name}: <span style={{ color: C.muted }}>{p.reason}</span></li>)}</ul>}</div>}
            <div style={{ textAlign: "end" }}><button type="button" style={button(true)} onClick={onClose}>Close</button></div>
          </>
        )}
      </div>
    </div>
  );
}
