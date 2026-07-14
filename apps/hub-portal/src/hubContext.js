import { createContext, useContext } from "react";

/**
 * Holds the real logged-in hub staff user (name, hub info) so the shell
 * can show real data without threading props through every component.
 */
export const HubContext = createContext({ currentUser: null, onLogout: () => {}, onSessionExpired: () => {} });
export const useHub = () => useContext(HubContext);
