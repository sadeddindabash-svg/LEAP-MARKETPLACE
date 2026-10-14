import type { Metadata } from "next";

// This section belongs to one person (their account, cart or orders): it must never appear in search results. The pages here are client components, which
// cannot export metadata themselves, so this layout does it for the whole section. robots.ts also keeps crawlers out (lib/seo.ts PRIVATE_PATHS lists both).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateSectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
