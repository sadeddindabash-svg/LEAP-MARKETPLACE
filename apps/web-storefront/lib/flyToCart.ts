// "Fly to cart": when a part is added, a small copy of its photo lifts off the page, arcs to the cart in the header and lands there; the cart then bounces and its
// number goes up. The cart (components/CartIcon.tsx) listens for the two events below: it holds its number while a part is in the air, and shows the new one,
// with a bounce, the moment it lands. Without the motion (the visitor asked their computer to reduce motion, no cart on screen, an old browser) the part lands
// at once: the number simply goes up.

export const FLY_START = "leap:cart-fly-start";
export const FLY_LANDED = "leap:cart-landed";
export const FLY_MS = 750;

/** A point of the arc at p (0..1): from the start, up over a high point, down onto the cart (a quadratic curve). */
export function arcPoint(p: number, from: { x: number; y: number }, to: { x: number; y: number }, lift = 90): { x: number; y: number } {
  const c = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  const q = 1 - p;
  return { x: q * q * from.x + 2 * q * p * c.x + p * p * to.x, y: q * q * from.y + 2 * q * p * c.y + p * p * to.y };
}

/** Ease in and out: slow off, fast in the middle, slow onto the cart. */
export const easeInOut = (p: number): number => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

function canAnimate(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return typeof Element !== "undefined" && typeof Element.prototype.animate === "function";
}

/** The cart on screen (the header can have more than one place for it, e.g. a phone layout): the first one that is visible. */
function cartOnScreen(): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

const landed = () => window.dispatchEvent(new Event(FLY_LANDED));

/**
 * Sends a part to the cart. `from` is what flies (its photo, else the button that was pressed). The cart is told at once (it holds its number) and again when the
 * part lands. Always ends with "landed", even if something goes wrong, so the cart never stays held.
 */
export function flyToCart(from: Element | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FLY_START));
  const cart = cartOnScreen();
  if (!from || !cart || !canAnimate()) { landed(); return; }
  try {
    const a = from.getBoundingClientRect();
    const b = cart.getBoundingClientRect();
    const size = Math.max(Math.min(a.width, a.height) * 0.55, 40);
    const end = 26;
    const start = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    const stop = { x: b.left + b.width / 2, y: b.top + b.height / 2 };

    const flyer = document.createElement("div");
    flyer.setAttribute("aria-hidden", "true");
    flyer.dataset.flyer = "";
    Object.assign(flyer.style, {
      position: "fixed", left: "0px", top: "0px", width: `${size}px`, height: `${size}px`, zIndex: "9999", pointerEvents: "none", borderRadius: "12px", overflow: "hidden",
      background: "#fff", border: "2px solid var(--color-signal, #f9b317)", boxShadow: "0 10px 24px rgba(11,49,70,.3)", display: "grid", placeItems: "center",
    } as Partial<CSSStyleDeclaration>);
    const img = from.querySelector("img");
    if (img?.currentSrc || img?.src) {
      const copy = document.createElement("img");
      copy.src = img.currentSrc || img.src;
      copy.alt = "";
      Object.assign(copy.style, { width: "100%", height: "100%", objectFit: "cover" });
      flyer.appendChild(copy);
    } else {
      flyer.style.background = "var(--color-signal, #f9b317)";          // no photo: a gold chip flies
    }
    document.body.appendChild(flyer);

    const steps = 16;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const at = arcPoint(easeInOut(p), start, stop);
      const s = size + (end - size) * easeInOut(p);
      frames.push({ transform: `translate(${at.x - s / 2}px, ${at.y - s / 2}px)`, width: `${s}px`, height: `${s}px`, opacity: p > 0.9 ? 1 - (p - 0.9) * 10 : 1, offset: p });
    }
    const run = flyer.animate(frames, { duration: FLY_MS, easing: "linear", fill: "forwards" });
    const done = () => { flyer.remove(); landed(); };
    run.onfinish = done;
    run.oncancel = done;
  } catch {
    landed();
  }
}
