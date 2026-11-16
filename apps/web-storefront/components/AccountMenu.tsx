"use client";

import Link from "@/components/LocLink";
import { useAuth } from "@/components/AuthProvider";
import NavDropdown from "@/components/NavDropdown";
import { useT } from "@/components/LangProvider";
import AccountMenuList from "./AccountMenuList";

const userIcon = (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>
);
const trigger = "flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-white hover:bg-white/10 group-data-[open=true]:bg-white/10";

/** Sign in when signed out; when signed in, "Account" drops down the account menu: the same list as beside the account pages (AccountMenuList), then Sign out. */
export default function AccountMenu() {
  const { user, isLoading } = useAuth();
  const t = useT();
  if (isLoading) return <span className="min-h-11 min-w-16" aria-hidden="true" />;
  if (!user) {
    return <Link href="/login" className={trigger}>{userIcon}<span>{t("sign_in")}</span></Link>;
  }
  return (
    <NavDropdown label={t("account_menu")} trigger={<>{userIcon}<span>{t("account")}</span></>} triggerClassName={trigger}
      panelClassName="absolute end-0 top-full z-30 mt-1.5 max-h-[calc(100vh-6rem)] w-[290px] overflow-y-auto rounded-[14px] border border-line bg-white p-2 text-ink shadow-[0_18px_40px_rgba(7,32,47,0.25)]">
      <AccountMenuList />
    </NavDropdown>
  );
}
