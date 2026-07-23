import { createContext, useContext } from "react";

/**
 * Extracted into its own file (rather than defined inline in App.jsx) so
 * LoginPage.jsx can use the same language toggle without a circular
 * import between App.jsx and LoginPage.jsx. Mirrors
 * apps/supplier-portal/src/langContext.js exactly -- same real gap
 * this portal had (English-only, flagged in this app's own README as
 * the #1 next step) closed the same established way.
 */
export const LangContext = createContext({ lang: "zh", t: null, toggle: () => {} });
export const useLang = () => useContext(LangContext);
