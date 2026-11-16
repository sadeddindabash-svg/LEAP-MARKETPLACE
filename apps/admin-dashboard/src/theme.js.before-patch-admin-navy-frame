// Real, shared design tokens -- extracted from App.jsx as a first,
// safe step toward this project's own documented next-step ("split
// src/App.jsx into separate files under src/pages/ and
// src/components/ ... before more people work on it"). Every
// eventual split file needs these same tokens, so this is the natural
// starting point: no behavior changes, just a real module boundary
// where App.jsx previously defined these inline.
//
// Real, confirmed with the person -- updated to match the real mobile
// app's own current design exactly (apps/mobile/lib/core/theme.dart),
// not the mobile app's own older, pre-rebrand palette this file had
// drifted to (the real gold #F2A71B here was still the real old
// orange-red #E8622C before this). Manrope replaces the real previous
// 3-font system (Barlow Condensed/Inter/JetBrains Mono) for display
// and body text, matching the mobile app's own real single uniform
// typeface -- JetBrains Mono is kept for the mono/plate-chip token
// specifically, since the mobile app's own plate-chip element also
// uses a real distinct monospace family for this exact purpose (just
// Flutter's own generic system monospace rather than a specific named
// font), so this is a reasonable, minor divergence rather than an
// actual mismatch. Dark mode is confirmed as a real, separate, later
// phase -- not part of this change.
export const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');";

export const C = {
  ink: "#14171C",
  panel: "#1B1F26",
  canvas: "#F5F6F8",
  card: "#FFFFFF",
  line: "#E4E6EA",
  lineDark: "#2A2F38",
  signal: "#F2A71B",
  signalDark: "#C4870D",
  // Real, new -- dark text-on-gold, matching the mobile app's own
  // real onSignal token exactly. Gold is too light for white text to
  // read well against it, matching the real site's own real contrast
  // choice (dark text on every real gold button/pill there).
  onSignal: "#241A05",
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
export const disp = { fontFamily: "'Manrope', sans-serif" };
export const body = { fontFamily: "'Manrope', sans-serif" };
export const mono = { fontFamily: "'JetBrains Mono', monospace" };
