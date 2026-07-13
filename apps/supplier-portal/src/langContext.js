import { createContext, useContext } from "react";

/**
 * Extracted into its own file (rather than defined inline in App.jsx) so
 * LoginPage.jsx can use the same language toggle without a circular
 * import between App.jsx and LoginPage.jsx.
 */
export const LangContext = createContext({ lang: "zh", t: null, toggle: () => {} });
export const useLang = () => useContext(LangContext);
