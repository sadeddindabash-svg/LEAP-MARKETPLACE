"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/LocLink";
import { useAuth } from "./AuthProvider";
import { useT } from "./LangProvider";
import { splitLang, type DictKey } from "@/lib/i18n";

const ITEMS: Array<[string, DictKey]> = [
  ["/account", "account_hub_title"], ["/account/loyalty", "loyalty_my_tier_title"], ["/orders", "orders_and_returns"], ["/part-requests", "my_requests_title"], ["/returns", "my_returns"], ["/addresses", "addresses"],
  ["/garage", "garage_title"], ["/wishlist", "wishlist"], ["/saved-searches", "saved_searches"], ["/referrals", "referrals"], ["/account/change-email", "change_email"],
  ["/account/two-factor", "two_factor_auth_label"], ["/contact", "contact_us_label"],
];

/** The account area: the sections in a side menu (on a phone it sits above the page). A visitor who is not signed in gets the page alone: it asks them to sign in. */
export default function AccountShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const t = useT();
  const here = splitLang(usePathname() || "/").path;
  if (!user) return <>{children}</>;
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label={t("account_sidebar")} className="lg:sticky lg:top-4 lg:self-start">
        <ul className="grid gap-1 rounded-[14px] border border-line bg-white p-2">
          {ITEMS.map(([href, key]) => (
            <li key={href}>
              <Link href={href} aria-current={here === href ? "page" : undefined} className={`flex min-h-11 items-center rounded-lg px-3 text-[15px] font-semibold ${here === href ? "bg-navy text-white" : "text-ink hover:bg-chalk"}`}>{t(key)}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
