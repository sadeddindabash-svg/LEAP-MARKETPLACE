import type { Metadata } from "next";

// The account area belongs to one person: never in search results (robots.ts also blocks it; lib/seo.ts PRIVATE_PATHS lists it).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;      // the account menu is drawn for the whole site (app/layout.tsx), so it also stays on the pages outside /account
}
