"use client";

import { useEffect, useRef, useState } from "react";
import SafeImage from "@/components/SafeImage";

/** The pointer rests on a card this long, then the next photo shows; after that the photos change this often. */
export const HOVER_DELAY_MS = 400;
export const HOVER_STEP_MS = 900;

/**
 * The photo of a product card. With a mouse, while the pointer is over the card the other photos of the part show in turn (the next one after 0.4 s, then one every 0.9 s, round to the first again), with a small capsule of dots saying where you are;
 * moving the pointer away returns to the first photo. Nothing moves on a phone or tablet (no pointer that can hover) or when the person asked their device to reduce motion: the card keeps its first photo. A part with one photo is just that photo.
 *
 * Until the pointer first enters, ONLY the first photo is on the page (a page of cards does not download the others). From then on every photo is in place, stacked, and the shown one fades in: no photo is ever replaced under the pointer,
 * because the browser then announces "pointer entered" again and again, which would keep restarting the timer. Entering is also ignored while the pointer is already inside.
 */
export default function CardPhotos({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [armed, setArmed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const count = images.length;
  const key = images.join("|");

  useEffect(() => {
    const card = root.current?.closest("li");        // the whole card, not just the photo
    if (!card || count < 2 || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let step: ReturnType<typeof setInterval> | undefined;
    let inside = false;
    const clear = () => { clearTimeout(wait); clearInterval(step); };
    const enter = () => {
      if (inside) return;                              // already counting: a repeated "entered" must not restart it
      inside = true;
      setArmed(true);
      setHovering(true);
      wait = setTimeout(() => {
        setIndex((i) => (i + 1) % count);
        step = setInterval(() => setIndex((i) => (i + 1) % count), HOVER_STEP_MS);
      }, HOVER_DELAY_MS);
    };
    const leave = () => { inside = false; clear(); setHovering(false); setIndex(0); };
    card.addEventListener("mouseenter", enter);
    card.addEventListener("mouseleave", leave);
    return () => { clear(); card.removeEventListener("mouseenter", enter); card.removeEventListener("mouseleave", leave); };
  }, [key, count]);

  return (
    <div ref={root} className="absolute inset-2">
      {(armed ? images : images.slice(0, 1)).map((src, i) => (
        <SafeImage key={`${i}|${src}`} src={src} alt={i === index ? alt : ""} fill sizes="(min-width: 1024px) 25vw, 50vw" className={`object-contain transition-opacity duration-200 motion-reduce:transition-none ${i === index ? "opacity-100" : "opacity-0"}`} unoptimized />
      ))}
      {hovering && count > 1 && (
        <div data-testid="photo-dots" aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 shadow-sm">
          {images.map((src, i) => <span key={src + i} data-active={i === index ? "true" : "false"} className={`h-1.5 rounded-full ${i === index ? "w-[18px] bg-navy" : "w-1.5 bg-navy/30"}`} />)}
        </div>
      )}
    </div>
  );
}
