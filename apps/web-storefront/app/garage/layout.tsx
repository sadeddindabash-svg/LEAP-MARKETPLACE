import type { Metadata } from "next";

// This section belongs to one person (their garage, or a comparison of their saved parts): it must never appear in search results. The pages here read the buyer's own data,
// so this layout does it for the whole section. robots.ts also keeps crawlers out (lib/seo.ts PRIVATE_PATHS lists both).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateSectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
