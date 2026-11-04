import type { Metadata } from "next";

// A buyer's own quotations: never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function QuotationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
