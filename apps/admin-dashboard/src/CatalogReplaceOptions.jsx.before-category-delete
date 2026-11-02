import React, { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { C, body } from "./theme";
import { exportToExcel } from "./exportToExcel";

// "Make the catalog exactly this sheet" on Categories > Import from Excel. CatalogReplaceOptions is the choice (off at first); CatalogRemovalPreview is the box that appears in the check: what would be removed, what stays and why, a
// list to download, and the sentence to type before the import will go ahead. The server asks for the same sentence again, so nothing here can be skipped.
export const REPLACE_PHRASE = "REPLACE CATALOG";
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const SHOWN = 12;

export function CatalogReplaceOptions({ replace, onChange }) {
  return (
    <div style={{ ...body, fontSize: 12.5, color: C.ink, marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
      <label style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        <input type="checkbox" checked={replace.on} onChange={(e) => onChange({ on: e.target.checked, confirm: "" })} style={{ marginTop: 2 }} />
        <span><b>Make the catalog exactly this sheet</b>: remove every category and sub-category that is not in it (the old ones made by hand, and the ones an earlier import added). Nothing is removed until you press Import and type a confirmation.</span>
      </label>
      {replace.on && (
        <label style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 8, marginInlineStart: 22 }}>
          <input type="checkbox" checked={replace.alsoProducts} onChange={(e) => onChange({ alsoProducts: e.target.checked, confirm: "" })} style={{ marginTop: 2 }} />
          <span>Also delete the products that use the old categories and sub-categories. A product that has ever been in an order is never deleted (order history keeps it), and neither is its category or sub-category. Leave this off if those products are real: a category or sub-category that a product still uses is then kept, and listed below with the reason.</span>
        </label>
      )}
    </div>
  );
}

export function CatalogRemovalPreview({ removal, replace, onChange }) {
  const [all, setAll] = useState({});
  const { counts, kept } = removal; const none = counts.categories + counts.parts + counts.products === 0; const keptTotal = kept.categories.length + kept.parts.length + kept.products.length;
  const list = (title, items, key, render) => items.length > 0 && (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <ul style={{ margin: "4px 0 0", paddingInlineStart: 20, lineHeight: 1.5 }}>{(all[key] ? items : items.slice(0, SHOWN)).map((x) => <li key={`${key}-${x.id}`}>{render(x)}</li>)}</ul>
      {items.length > SHOWN && !all[key] && <button type="button" onClick={() => setAll((a) => ({ ...a, [key]: true }))} style={{ ...body, fontSize: 12, background: "none", border: "none", color: C.ink, textDecoration: "underline", cursor: "pointer", padding: 0, marginInlineStart: 20 }}>Show all {items.length}</button>}
    </div>
  );
  const download = () => exportToExcel({
    sheetName: "To be removed", filename: "Catalog_to_be_removed.xlsx",
    columns: [{ header: "What", key: "what", width: 14 }, { header: "Id", key: "id", width: 28 }, { header: "Name", key: "name", width: 34 }, { header: "In category", key: "category", width: 24 }, { header: "Code", key: "code", width: 12 }, { header: "Stays?", key: "stays", width: 12 }, { header: "Why it stays", key: "reason", width: 46 }],
    rows: [...removal.categories.map((c) => ({ what: "Category", id: c.id, name: c.name, code: c.code || "", stays: "removed" })), ...removal.parts.map((p) => ({ what: "Sub-category", id: p.id, name: p.name, category: p.category, code: p.code || "", stays: "removed" })), ...removal.products.map((p) => ({ what: "Product", id: p.id, name: p.name, category: p.category, stays: "removed" })),
      ...kept.categories.map((c) => ({ what: "Category", id: c.id, name: c.name, stays: "stays", reason: c.reason })), ...kept.parts.map((p) => ({ what: "Sub-category", id: p.id, name: p.name, category: p.category, stays: "stays", reason: p.reason })), ...kept.products.map((p) => ({ what: "Product", id: p.id, name: p.name, category: p.category, stays: "stays", reason: p.reason }))],
  });
  return (
    <div id="catalog-removal-box" style={{ border: `1px solid ${none ? C.line : "#B42318"}`, borderRadius: 10, padding: 14, marginTop: 14, background: none ? C.card : "#FFF8F7" }}>
      <div style={{ ...body, fontSize: 14, fontWeight: 700, color: none ? C.ink : "#B42318", display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={15} /> {none ? "Nothing old to remove" : "Will be removed (it is not in this sheet)"}</div>
      <div style={{ ...body, fontSize: 13, color: C.ink, margin: "6px 0" }}>
        <b>{plural(counts.categories, "category", "categories")}</b>, <b>{plural(counts.parts, "sub-category", "sub-categories")}</b>{replace.alsoProducts && <>, <b>{plural(counts.products, "product", "products")}</b></>}.
        {keptTotal > 0 && <span style={{ color: C.muted }}> {plural(keptTotal, "item stays", "items stay")} because a product still uses {keptTotal === 1 ? "it" : "them"} (listed below).</span>}
      </div>
      {list("Categories", removal.categories, "c", (c) => <>{c.name}{c.code ? ` (${c.code})` : ""}</>)}
      {list("Sub-categories", removal.parts, "p", (p) => <>{p.name} <span style={{ color: C.muted }}>in {p.category}</span></>)}
      {list("Products", removal.products, "pr", (p) => <>{p.name} <span style={{ color: C.muted }}>({p.id})</span></>)}
      {keptTotal > 0 && <div style={{ marginTop: 10 }}>
        {list("Stay, and why", [...kept.categories.map((c) => ({ ...c, id: `c-${c.id}`, label: `Category ${c.name}` })), ...kept.parts.map((p) => ({ ...p, id: `p-${p.id}`, label: `Sub-category ${p.name}` })), ...kept.products.map((p) => ({ ...p, id: `pr-${p.id}`, label: `Product ${p.name}` }))], "k", (x) => <>{x.label}: <span style={{ color: C.muted }}>{x.reason}</span></>)}
      </div>}
      <div style={{ marginTop: 10 }}><button type="button" onClick={download} style={{ ...body, fontSize: 12.5, fontWeight: 600, padding: "6px 10px", borderRadius: 8, cursor: "pointer", border: `1px solid ${C.line}`, background: "#fff", color: C.ink, display: "inline-flex", gap: 6, alignItems: "center" }}><Download size={13} /> Download this list (.xlsx)</button></div>
      <div style={{ ...body, fontSize: 12.5, color: C.ink, marginTop: 12 }}>
        <b>This cannot be undone.</b> "Undo" in the imports list only removes what an import added; it does not bring back what was removed here. To go ahead, type <code>{REPLACE_PHRASE}</code>:
        <div style={{ marginTop: 6 }}><input aria-label="Type to confirm" placeholder={`Type ${REPLACE_PHRASE}`} value={replace.confirm} onChange={(e) => onChange({ confirm: e.target.value })} style={{ ...body, fontSize: 13, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, width: 240 }} /></div>
      </div>
    </div>
  );
}

/** A short red line right under the summary tiles, so the removal is never missed at the bottom of a long list: what will be removed, and a button to the full list and the confirmation. */
export function CatalogRemovalBanner({ removal }) {
  const { counts } = removal; const total = counts.categories + counts.parts + counts.products; if (total === 0) return null;
  const jump = () => document.getElementById("catalog-removal-box")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  return (
    <div role="note" style={{ ...body, fontSize: 13, color: "#B42318", background: "#FFF8F7", border: "1px solid #B42318", borderRadius: 8, padding: "8px 12px", marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <AlertTriangle size={15} />
      <span><b>This import will also remove</b> {plural(counts.categories, "category", "categories")}, {plural(counts.parts, "sub-category", "sub-categories")}{counts.products > 0 ? `, ${plural(counts.products, "product", "products")}` : ""} that are not in this sheet.</span>
      <button type="button" onClick={jump} style={{ ...body, fontSize: 12.5, fontWeight: 600, padding: "5px 10px", borderRadius: 8, cursor: "pointer", border: "1px solid #B42318", background: "#fff", color: "#B42318" }}>See the list and confirm</button>
    </div>
  );
}
