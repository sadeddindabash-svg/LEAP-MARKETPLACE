import type { Metadata } from "next";

// A form, not a page worth finding: kept out of search results (robots.ts also blocks it; lib/seo.ts PRIVATE_PATHS lists it).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateSectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
