"use client";

import { useEffect, useState } from "react";
import { COMPARE_MAX, COMPARE_MAX_PHONE, PHONE_MAX_WIDTH } from "@/lib/compare";

/**
 * How many parts can be picked for a comparison on THIS screen: 2 on a phone (under 768 px wide, held either way), 4 on a tablet or a computer. It starts at 4 (what the server draws) and changes after the page is shown,
 * and follows the screen if it is turned or resized.
 */
export default function useCompareMax(): number {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return phone ? COMPARE_MAX_PHONE : COMPARE_MAX;
}
