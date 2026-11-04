"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** A page's own buttons in the navy box at the top of an account page (the account menu's #account-header-actions); where there is no box (signed out,
 *  or the page on its own), they stay in the page, where the page put them. `onNavy` tells the buttons which of the two they are drawn on. */
export function InAccountHeader({ children }: { children: (onNavy: boolean) => ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(document.getElementById("account-header-actions")); }, []);
  return slot ? createPortal(children(true), slot) : <>{children(false)}</>;
}
