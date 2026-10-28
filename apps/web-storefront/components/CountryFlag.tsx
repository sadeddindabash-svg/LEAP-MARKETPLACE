import type { ReactElement } from "react";
import type { FlagCode } from "@/lib/countryFlags";

/**
 * A small flag (21 x 14 px) drawn as a picture of its own: no emoji (Windows does not draw flag emoji), no download. Each is a simple shape, drawn to the official colours and proportions as closely as a 21 px flag allows.
 * Only the flags that can be drawn faithfully are here (see lib/countryFlags.ts); any other country keeps the globe.
 */
const FLAGS: Record<FlagCode, ReactElement> = {
  CN: (<><rect width="30" height="20" fill="#de2910" /><g fill="#ffde00"><path d="M5.00 2.00L5.67 4.07L7.85 4.07L6.09 5.35L6.76 7.43L5.00 6.15L3.24 7.43L3.91 5.35L2.15 4.07L4.33 4.07Z" /><path d="M9.14 2.51L9.62 1.97L9.25 1.34L9.91 1.63L10.39 1.08L10.33 1.80L11.00 2.09L10.29 2.25L10.22 2.97L9.85 2.35Z" /><path d="M11.01 4.14L11.66 3.82L11.56 3.10L12.07 3.62L12.72 3.30L12.38 3.95L12.88 4.47L12.17 4.34L11.83 4.99L11.73 4.27Z" /><path d="M11.04 6.73L11.76 6.70L11.96 6.00L12.21 6.68L12.94 6.66L12.37 7.10L12.62 7.79L12.01 7.38L11.44 7.83L11.64 7.13Z" /><path d="M9.22 8.38L9.90 8.63L10.35 8.06L10.32 8.79L11.00 9.05L10.30 9.24L10.26 9.96L9.87 9.36L9.16 9.55L9.62 8.98Z" /></g></>),
  JP: (<><rect width="30" height="20" fill="#fff" /><circle cx="15" cy="10" r="6" fill="#bc002d" /></>),
  DE: (<><rect width="30" height="20" fill="#000" /><rect y="6.67" width="30" height="13.33" fill="#dd0000" /><rect y="13.33" width="30" height="6.67" fill="#ffce00" /></>),
  FR: (<><rect width="30" height="20" fill="#fff" /><rect width="10" height="20" fill="#0055a4" /><rect x="20" width="10" height="20" fill="#ef4135" /></>),
  IT: (<><rect width="30" height="20" fill="#fff" /><rect width="10" height="20" fill="#009246" /><rect x="20" width="10" height="20" fill="#ce2b37" /></>),
  AE: (<><rect width="30" height="20" fill="#fff" /><rect x="7.5" width="22.5" height="6.67" fill="#00732f" /><rect x="7.5" y="13.33" width="22.5" height="6.67" fill="#000" /><rect width="7.5" height="20" fill="#f00" /></>),
  TR: (<><rect width="30" height="20" fill="#e30a17" /><circle cx="10.5" cy="10" r="5" fill="#fff" /><circle cx="11.9" cy="10" r="4" fill="#e30a17" /><path d="M13.70 10.00L15.43 9.44L15.43 7.62L16.50 9.09L18.22 8.53L17.15 10.00L18.22 11.47L16.50 10.91L15.43 12.38L15.43 10.56Z" fill="#fff" /></>),
  VN: (<><rect width="30" height="20" fill="#da251d" /><path d="M15.00 3.80L16.39 8.08L20.90 8.08L17.25 10.73L18.64 15.02L15.00 12.37L11.36 15.02L12.75 10.73L9.10 8.08L13.61 8.08Z" fill="#ff0" /></>),
  TH: (<><rect width="30" height="20" fill="#a51931" /><rect y="3.33" width="30" height="13.33" fill="#f4f5f8" /><rect y="6.67" width="30" height="6.67" fill="#2d2a4a" /></>),
  IN: (<><rect width="30" height="20" fill="#fff" /><rect width="30" height="6.67" fill="#f93" /><rect y="13.33" width="30" height="6.67" fill="#138808" /><circle cx="15" cy="10" r="2.3" fill="none" stroke="#000080" strokeWidth="0.6" /><circle cx="15" cy="10" r="0.5" fill="#000080" /></>),
  US: (<><rect width="30" height="20" fill="#fff" />{[0, 2, 4, 6, 8, 10, 12].map((i) => <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#b22234" />)}<rect width="12" height="10.77" fill="#3c3b6e" />{[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3, 4].map((c) => <circle key={`${r}${c}`} cx={1.4 + c * 2.3} cy={1.5 + r * 2.4} r="0.5" fill="#fff" />))}</>),
  GB: (<><rect width="30" height="20" fill="#012169" /><path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="3.4" /><path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" strokeWidth="1.2" /><path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="5.6" /><path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth="3.2" /></>),
};

export default function CountryFlag({ code }: { code: FlagCode }) {
  return (
    <svg aria-hidden="true" data-testid="country-flag" data-flag={code} viewBox="0 0 30 20" width="21" height="14" overflow="hidden" className="shrink-0 rounded-[2px] shadow-[0_0_0_1px_#d7e0e6]">
      {FLAGS[code]}
    </svg>
  );
}
