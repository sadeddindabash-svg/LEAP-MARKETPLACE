"use client";

import Link from "@/components/LocLink";
import { useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";

const userIcon = (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>
);
const trigger = "flex min-h-11 min-w-11 cursor-pointer list-none flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-white hover:bg-white/10";

/** Sign in when signed out; when signed in, one "Account" menu with everything that used to be a row of loose links. */
export default function AccountMenu() {
  const { user, isLoading, logout } = useAuth();
  const t = useT();
  if (isLoading) return <span className="min-h-11 min-w-16" aria-hidden="true" />;
  if (!user) {
    return <Link href="/login" className={trigger}>{userIcon}<span>{t("sign_in")}</span></Link>;
  }
  const items: Array<[string, Parameters<typeof t>[0]]> = [["/account", "account_hub_title"], ["/orders", "my_orders"], ["/returns", "returns"], ["/wishlist", "wishlist"], ["/saved-searches", "saved_searches"], ["/garage", "garage_title"], ["/addresses", "addresses"], ["/referrals", "referrals"], ["/support", "support"]];
  return (
    <details className="relative">
      <summary className={trigger} aria-label={t("account_menu")}>{userIcon}<span>{t("account")}</span></summary>
      <div className="absolute end-0 top-full z-30 mt-1 w-56 rounded-xl border border-line bg-white p-2 text-sm text-ink shadow-lg">
        {items.map(([href, key]) => (
          <Link key={href} href={href} className="block rounded-lg px-3 py-2.5 font-medium hover:bg-chalk">{t(key)}</Link>
        ))}
        <button type="button" onClick={logout} className="mt-1 block w-full rounded-lg border-t border-line px-3 py-2.5 text-start font-medium hover:bg-chalk">{t("sign_out")}</button>
      </div>
    </details>
  );
}
