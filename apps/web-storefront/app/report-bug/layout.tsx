import type { Metadata } from "next";

// A bug report is a form, not a page to find in a search: never in search results (robots.ts also keeps crawlers out; lib/seo.ts PRIVATE_PATHS lists it).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ReportBugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
