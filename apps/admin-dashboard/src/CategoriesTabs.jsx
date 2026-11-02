import React, { useState } from "react";
import { FolderTabs } from "./components/PageChrome";
import CatalogImportPanel from "./CatalogImportPanel";
import CatalogEditorPanel from "./CatalogEditorPanel";
import CatalogPhotosPanel from "./CatalogPhotosPanel";

// The Categories page with more tabs beside it: "Import from Excel" (the parts catalog), "Edit details" (every field of a category or part) and "Photos". `main` is the page as it has always been.
// `header(tabs)` draws the page's header with these tabs under it (the common page design); without it (tests) the tabs are drawn on their own.
const TABS = [["categories", "Categories"], ["import", "Import from Excel"], ["edit", "Edit details"], ["photos", "Photos"]];

export default function CategoriesTabs({ main, onSessionExpired, header }) {
  const [tab, setTab] = useState("categories");
  const tabs = { label: "Categories sections", tabs: TABS.map(([id, label]) => ({ id, label })), activeId: tab, onSelect: setTab };
  return (
    <div>
      {header ? header(tabs) : <FolderTabs {...tabs} />}
      {tab === "categories" && main}
      {tab === "import" && <div style={{ padding: "16px 24px 24px" }}><CatalogImportPanel onSessionExpired={onSessionExpired} /></div>}
      {tab === "edit" && <div style={{ padding: "16px 24px 24px" }}><CatalogEditorPanel onSessionExpired={onSessionExpired} /></div>}
      {tab === "photos" && <div style={{ padding: "16px 24px 24px" }}><CatalogPhotosPanel onSessionExpired={onSessionExpired} /></div>}
    </div>
  );
}
