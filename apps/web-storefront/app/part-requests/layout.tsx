import type { Metadata } from "next";

// A buyer's own requests: never in search results (robots.ts also blocks them; lib/seo.ts PRIVATE_PATHS lists the section).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateSectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
