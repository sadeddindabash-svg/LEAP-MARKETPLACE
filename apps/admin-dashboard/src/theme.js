// Real, shared design tokens -- extracted from App.jsx as a first,
// safe step toward this project's own documented next-step ("split
// src/App.jsx into separate files under src/pages/ and
// src/components/ ... before more people work on it"). Every
// eventual split file needs these same tokens, so this is the natural
// starting point: no behavior changes, just a real module boundary
// where App.jsx previously defined these inline.
export const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');";

export const C = {
  ink: "#14171C",
  panel: "#1B1F26",
  canvas: "#F5F6F8",
  card: "#FFFFFF",
  line: "#E4E6EA",
  lineDark: "#2A2F38",
  signal: "#E8622C",
  torque: "#2A5FD9",
  gauge: "#1E9D6B",
  amber: "#B9791F",
  red: "#C0362C",
  muted: "#6B7280",
  gaugeBg: "#E4F5EC",
  amberBg: "#FCEFD8",
  torqueBg: "#E9EFFC",
  redBg: "#FBE7E5",
};
export const disp = { fontFamily: "'Barlow Condensed', sans-serif" };
export const body = { fontFamily: "'Inter', sans-serif" };
export const mono = { fontFamily: "'JetBrains Mono', monospace" };
