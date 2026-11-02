import { useLang } from "./langContext";

// Real, shared design tokens -- extracted from App.jsx as a first,
// safe step toward this project's own documented next-step ("split
// src/App.jsx into separate files ... this file is large now" --
// same note as the admin dashboard's, already acted on there this
// session). No behavior change, just a real module boundary where
// App.jsx previously defined these inline.
export const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');";

export const C = {
  ink: "#14171C", canvas: "#F5F6F8", card: "#FFFFFF", line: "#E4E6EA",
  signal: "#E8622C", torque: "#2A5FD9", gauge: "#1E9D6B", amber: "#B9791F", red: "#C0362C",
  muted: "#6B7280", gaugeBg: "#E4F5EC", amberBg: "#FCEFD8", torqueBg: "#E9EFFC", redBg: "#FBE7E5",
};
export const disp = { fontFamily: "'Barlow Condensed', sans-serif" };
export const mono = { fontFamily: "'JetBrains Mono', monospace" };

// body font switches with language so CJK glyphs render properly in zh mode
export function useBodyFont() {
  const { lang } = useLang();
  return { fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" };
}
