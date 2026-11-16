import { useLang } from "./langContext";
// LEAP portals design, the same as the admin portal (patch-portals-redesign)

// Real, shared design tokens -- extracted from App.jsx as a first,
// safe step toward this project's own documented next-step ("split
// src/App.jsx into separate files ... this file is large now" --
// same note as the admin dashboard's, already acted on there this
// session). No behavior change, just a real module boundary where
// App.jsx previously defined these inline.
export const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');";

export const C = {
  ink: "#14171C", canvas: "#F5F6F8", card: "#FFFFFF", line: "#E4E6EA",
  // The LEAP portals design (the same as the admin portal): navy frame, gold for the next step with navy text on it.
  signal: "#F9B317", signalDark: "#E39F0C", onSignal: "#0B3146", signalText: "#8A5A12", navy: "#0B3146", navyDeep: "#07202F", navySoft: "#1F5574", onNavyMuted: "#9FB4C3",
  goldTint: "#FDF3D8", surfaceHigh: "#F9FAFB", lineStrong: "#CFD4DB",
  torque: "#2A5FD9", gauge: "#1E9D6B", amber: "#B9791F", red: "#C0362C",
  muted: "#636B78", gaugeBg: "#E3F4EC", amberBg: "#FBF0DC", torqueBg: "#E6EDFC", redBg: "#FAE6E4",
  gaugeInk: "#13714B", amberInk: "#8A5A12", torqueInk: "#2350B8", redInk: "#A82E25",
};
export const SHADOW = {
  card: "0 1px 2px rgba(11,49,70,0.06), 0 4px 12px rgba(11,49,70,0.06)",
  navyRaised: "0 1px 3px rgba(11,49,70,0.12), 0 3px 6px rgba(11,49,70,0.2), 0 10px 24px rgba(11,49,70,0.18)",
  goldRaised: "0 1px 0 rgba(255,255,255,0.45) inset, 0 2px 4px rgba(227,159,12,0.35), 0 6px 14px rgba(227,159,12,0.25)",
};
export const disp = { fontFamily: "'Manrope', 'Noto Sans SC', sans-serif" };
export const mono = { fontFamily: "'JetBrains Mono', monospace" };

// body font switches with language so CJK glyphs render properly in zh mode
export function useBodyFont() {
  const { lang } = useLang();
  return { fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Manrope', 'Noto Sans SC', sans-serif" };
}
