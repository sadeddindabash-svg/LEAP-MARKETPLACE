"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/LocLink";
import { useAuth } from "./AuthProvider";
import { useT } from "./LangProvider";
import { splitLang } from "@/lib/i18n";
import { ACCOUNT_MENU_ITEMS, AccountMenuIcon, menuPageOf, useAccountUnread } from "./AccountShell";

/**
 * The account menu's list, the same as beside the account pages (confirmed with the person via mockup): every page with its icon and name, the page the buyer is on
 * navy with a gold icon and edge, the number of unread notifications in gold, then Sign out. Used by "Account" in the header (PC and tablet) and in the phone's
 * bottom bar. `onPick` closes the panel it is in.
 */
export default function AccountMenuList({ onPick, live = true }: { onPick?: () => void; live?: boolean }) {
  const { logout } = useAuth();
  const t = useT();
  const here = splitLang(usePathname() || "/").path;
  const marked = menuPageOf(here);
  const unread = useAccountUnread(live, here);
  return (
    <>
      <ul className="grid gap-0.5" data-testid="account-menu-list">
        {ACCOUNT_MENU_ITEMS.map(([href, key]) => (
          <li key={href}>
            <Link href={href} onClick={onPick} aria-current={here === href ? "page" : marked === href ? "true" : undefined}
              className={`relative flex min-h-10 items-center gap-2.5 rounded-[10px] px-3 text-[14.5px] font-semibold ${marked === href ? "bg-gradient-to-br from-navy to-[#173f57] text-white" : "text-ink hover:bg-chalk"}`}>
              {marked === href && <span aria-hidden="true" className="absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-signal" />}
              <span className={`flex-none ${marked === href ? "text-signal" : "text-[#8a97a3]"}`}><AccountMenuIcon href={href} size={18} /></span>
              <span className="min-w-0 flex-1">{t(key)}</span>
              {href === "/notifications" && unread > 0 && <span aria-hidden="true" className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-signal px-1.5 text-xs font-extrabold text-navy">{unread > 99 ? "99+" : unread}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => { onPick?.(); logout(); }} className="mt-1 block w-full border-t border-line px-3 py-2.5 text-start text-[14.5px] font-semibold text-[#a12a21] hover:bg-chalk">{t("sign_out")}</button>
    </>
  );
}
