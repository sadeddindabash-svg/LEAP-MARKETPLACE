import type { Metadata } from "next";
import AccountShell from "@/components/AccountShell";

// The account area belongs to one person: never in search results (robots.ts also blocks it; lib/seo.ts PRIVATE_PATHS lists it).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
