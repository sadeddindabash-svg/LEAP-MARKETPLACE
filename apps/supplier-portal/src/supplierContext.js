import { createContext, useContext } from "react";

/**
 * Holds the real logged-in supplier's profile (name, verification status,
 * etc.) so TopBar and the sidebar footer can show real data without
 * threading props through every page component. This is the fix for the
 * same "hardcoded company name in the header" problem the admin dashboard
 * left as a known gap — solved properly here since the existing
 * LangContext pattern in this app made it low-effort to do right.
 */
export const SupplierContext = createContext({ profile: null, currentUser: null, onLogout: () => {} });
export const useSupplier = () => useContext(SupplierContext);
