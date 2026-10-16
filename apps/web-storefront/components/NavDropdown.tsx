"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const LEAVE_DELAY_MS = 300;       // how long the mouse may be away before the menu hides (so a small slip does not close it)

/**
 * A menu that opens on a click and closes BY ITSELF: when the buyer clicks or taps anywhere else, presses Escape (focus goes back to the button), chooses a link or button in it,
 * moves to another page, tabs to something outside it, or (with a mouse) moves the pointer away for a third of a second. A touch screen has no "moving away", so there only the
 * others apply. (The old <details> menus stayed open until clicked again, also while the buyer went on to something else.)
 *
 * The panel is HIDDEN, not removed, while closed: its links stay in the page's HTML, which is how search engines find the category pages behind the Sections menu.
 */
export default function NavDropdown({ trigger, label, triggerClassName, panelClassName, children }: { trigger: ReactNode; label?: string; triggerClassName: string; panelClassName: string; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  // "open for this page": when the page changes the menu is no longer open, with nothing to switch off by hand
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();
  const setOpen = useCallback((next: boolean) => setOpenFor(next ? pathname : null), [pathname]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); window.clearTimeout(timer.current); };
  }, [open, setOpen]);

  return (
    <div
      ref={box}
      className="group relative"
      data-open={open}
      onPointerEnter={() => window.clearTimeout(timer.current)}
      onPointerLeave={(e) => { if (open && e.pointerType === "mouse") { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), LEAVE_DELAY_MS); } }}
      onBlur={(e) => { if (e.relatedTarget && !box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
    >
      <button ref={button} type="button" aria-expanded={open} aria-controls={id} aria-haspopup="true" aria-label={label} className={triggerClassName} onClick={() => setOpen(!open)}>
        {trigger}
      </button>
      <div id={id} hidden={!open} className={panelClassName} onClick={(e) => { if ((e.target as HTMLElement).closest("a, button")) setOpen(false); }}>
        {children}
      </div>
    </div>
  );
}
