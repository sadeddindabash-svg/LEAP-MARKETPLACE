import type { Metadata } from "next";

// The address book belongs to one person: it must never appear in search results (robots.ts also keeps crawlers out; lib/seo.ts PRIVATE_PATHS lists both).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateSectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
