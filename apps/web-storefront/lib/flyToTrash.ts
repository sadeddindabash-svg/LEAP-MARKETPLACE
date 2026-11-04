// Removing a part from the basket: the same motion as "fly to cart", the other way. A red trash can appears at the bottom middle of the screen, the part's photo
// arcs into it (tilting as it falls, 3/4 of a second), the lid opens as it drops in and closes, and the can fades away. The returned promise settles when the part
// is in the can, so the line can then fold away. Without the motion (the visitor asked to reduce motion, an old browser) it settles at once.
import { arcPoint, easeInOut, FLY_MS } from "./flyToCart";

const CAN_SVG = `<svg viewBox="0 0 64 76" width="64" height="76" aria-hidden="true">
<g data-lid style="transform-origin: 8px 14px; transform-box: view-box"><rect x="4" y="10" width="56" height="7" rx="3" fill="#a12a21"/><rect x="24" y="4" width="16" height="7" rx="3" fill="#a12a21"/></g>
<path d="M9 21h46l-4 51H13z" fill="#c62f26"/><path d="M22 30v34M32 30v34M42 30v34" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/></svg>`;

function canAnimate(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return typeof Element !== "undefined" && typeof Element.prototype.animate === "function";
}

/** Sends a part's photo (`from`) into the trash can. Resolves when it is in (at once without the motion). Never rejects. */
export function flyToTrash(from: Element | null): Promise<void> {
  if (!from || !canAnimate()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    try {
      const a = from.getBoundingClientRect();
      const can = document.createElement("div");
      can.setAttribute("aria-hidden", "true");
      can.dataset.trashCan = "";
      Object.assign(can.style, { position: "fixed", left: "50%", bottom: "28px", width: "64px", height: "76px", marginLeft: "-32px", zIndex: "9998", pointerEvents: "none" } as Partial<CSSStyleDeclaration>);
      can.innerHTML = CAN_SVG;
      document.body.appendChild(can);
      const b = can.getBoundingClientRect();
      const stop = { x: b.left + b.width / 2, y: b.top + 10 };
      const start = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
      const size = Math.max(Math.min(a.width, a.height), 40);

      const flyer = document.createElement("div");
      flyer.setAttribute("aria-hidden", "true");
      flyer.dataset.trashFlyer = "";
      Object.assign(flyer.style, {
        position: "fixed", left: "0px", top: "0px", width: `${size}px`, height: `${size}px`, zIndex: "9999", pointerEvents: "none", borderRadius: "10px", overflow: "hidden",
        background: "#fff", border: "2px solid #a12a21", boxShadow: "0 8px 20px rgba(0,0,0,.25)",
      } as Partial<CSSStyleDeclaration>);
      const img = from.querySelector("img");
      if (img?.currentSrc || img?.src) {
        const copy = document.createElement("img");
        copy.src = img.currentSrc || img.src; copy.alt = "";
        Object.assign(copy.style, { width: "100%", height: "100%", objectFit: "cover" });
        flyer.appendChild(copy);
      }
      document.body.appendChild(flyer);

      can.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: 200, easing: "ease-out", fill: "forwards" });
      const steps = 16;
      const frames: Keyframe[] = [];
      for (let i = 0; i <= steps; i++) {
        const p = i / steps;
        const e = easeInOut(p);
        const at = arcPoint(e, start, stop, 80);
        const s = size * (1 - 0.55 * e);
        frames.push({ transform: `translate(${at.x - s / 2}px, ${at.y - s / 2}px) rotate(${-25 * e}deg)`, width: `${s}px`, height: `${s}px`, opacity: p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1, offset: p });
      }
      const lid = can.querySelector<SVGGElement>("[data-lid]");
      lid?.animate([{ transform: "rotate(0)" }, { transform: "rotate(0)", offset: 0.45 }, { transform: "rotate(-35deg)", offset: 0.75 }, { transform: "rotate(0)" }], { duration: FLY_MS + 300, easing: "ease-in-out" });
      const run = flyer.animate(frames, { duration: FLY_MS, easing: "linear", fill: "forwards" });
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        flyer.remove();
        resolve();
        const out = can.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, delay: 450, fill: "forwards" });
        out.onfinish = () => can.remove();
        out.oncancel = () => can.remove();
      };
      run.onfinish = finish;
      run.oncancel = finish;
    } catch {
      document.querySelectorAll("[data-trash-flyer],[data-trash-can]").forEach((el) => el.remove());
      resolve();
    }
  });
}

/** Folds a line away (its height to nothing). `done` settles when it is folded (at once without the motion); `undo` unfolds it again (for when the removal failed). */
export function foldAway(el: HTMLElement | null): { done: Promise<void>; undo: () => void } {
  if (!el || !canAnimate()) return { done: Promise.resolve(), undo: () => {} };
  let run: Animation | null = null;
  const done = new Promise<void>((resolve) => {
    try {
      const h = el.getBoundingClientRect().height;
      run = el.animate([{ height: `${h}px`, opacity: 1, overflow: "hidden" }, { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px", overflow: "hidden" }], { duration: 280, easing: "ease-in", fill: "forwards" });
      run.onfinish = () => resolve();
      run.oncancel = () => resolve();
    } catch { resolve(); }
  });
  return { done, undo: () => { try { (run as Animation | null)?.cancel(); } catch { /* nothing to undo */ } } };
}
