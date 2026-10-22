import React, { useState } from "react";
import { C, body } from "./theme";
import CatalogImportPanel from "./CatalogImportPanel";
import CatalogEditorPanel from "./CatalogEditorPanel";

// The Categories page with two more tabs beside it: "Import from Excel" (the parts catalog) and "Edit details" (every field of a category or part). `main` is the page as it has always been.
const TABS = [["categories", "Categories"], ["import", "Import from Excel"], ["edit", "Edit details"]];

export default function CategoriesTabs({ main, onSessionExpired }) {
  const [tab, setTab] = useState("categories");
  return (
    <div>
      <div role="tablist" aria-label="Categories sections" style={{ display: "flex", gap: 6, padding: "14px 24px 0" }}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            style={{ ...body, padding: "8px 16px", borderRadius: 8, border: "none", background: tab === id ? C.ink : "transparent", color: tab === id ? "#fff" : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {tab === "categories" && main}
      {tab === "import" && <div style={{ padding: "16px 24px 24px" }}><CatalogImportPanel onSessionExpired={onSessionExpired} /></div>}
      {tab === "edit" && <div style={{ padding: "16px 24px 24px" }}><CatalogEditorPanel onSessionExpired={onSessionExpired} /></div>}
    </div>
  );
}
