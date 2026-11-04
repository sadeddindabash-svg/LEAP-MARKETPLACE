import type { Metadata } from "next";

// A quotation's check page belongs to whoever holds its code: never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function QuotationCheckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
