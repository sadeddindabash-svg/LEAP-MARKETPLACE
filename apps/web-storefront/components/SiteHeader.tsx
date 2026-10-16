import Image from "next/image";
import Link from "@/components/LocLink";
import { fetchCategories } from "@/lib/api";
import { isShopReachable } from "@/lib/net";
import { pickName, t, type Lang } from "@/lib/i18n";
import AccountMenu from "./AccountMenu";
import CartIcon from "./CartIcon";
import CurrencySwitcher from "./CurrencySwitcher";
import { Suspense } from "react";
import NavDropdown from "./NavDropdown";
import HeaderSearch from "./HeaderSearch";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "./NotificationBell";
import VehicleBar from "./VehicleBar";

const actionClass = "relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-white hover:bg-white/10";

// The header of every page, in the "Navy Workshop" theme: a thin bar (tagline, support, language), the main bar (logo, search, account, wishlist, alerts, cart), the menu
// (Home, Products, Sections) and a yellow announcement line. A Server Component: the menu's section names come from the real categories, in the page's language.
export default async function SiteHeader({ lang }: { lang: Lang }) {
  const [categories, reachable] = await Promise.all([fetchCategories(), isShopReachable(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000")]);
  return (
    <header>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-signal focus:px-4 focus:py-2 focus:font-bold focus:text-on-signal">{t(lang, "skip_to_content")}</a>
      <div className="bg-navy-deep text-[13px] text-[#c9d6de]">
        <div className="mx-auto flex min-h-9 max-w-7xl flex-wrap items-center justify-between gap-x-6 px-4 sm:px-8">
          <span>{t(lang, "util_tagline")}</span>
          <span className="flex items-center gap-5">
            <Link href="/support" className="hover:underline">{t(lang, "support")}</Link>
            <CurrencySwitcher />
            <Suspense fallback={null}><LanguageSwitcher /></Suspense>
          </span>
        </div>
      </div>
      <div className="bg-navy text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8 lg:grid-cols-[auto_minmax(260px,1fr)_auto]">
          <Link href="/" aria-label={t(lang, "logo_home_label")} className="flex items-center gap-3 text-[22px] font-bold tracking-tight">
            <Image src="/leap-logo.png" alt="" width={52} height={52} priority className="rounded-full" />
            <span>Leap<span className="font-medium opacity-85"> Auto Parts</span></span>
          </Link>
          <HeaderSearch />
          <nav aria-label={t(lang, "account_menu")} className="flex items-center justify-end gap-1">
            <AccountMenu />
            <Link href="/wishlist" className={actionClass}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
              <span>{t(lang, "wishlist")}</span>
            </Link>
            <NotificationBell />
            <CartIcon />
          </nav>
        </div>
      </div>
      <nav aria-label="Main" className="border-b border-line bg-white text-ink">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 sm:px-8">
          <Link href="/" className="flex min-h-12 items-center rounded-lg px-4 text-[15px] font-semibold hover:bg-chalk">{t(lang, "nav_home")}</Link>
          <Link href="/search" className="flex min-h-12 items-center rounded-lg px-4 text-[15px] font-semibold hover:bg-chalk">{t(lang, "nav_products")}</Link>
          <Link href="/find" className="flex min-h-12 items-center rounded-lg px-4 text-[15px] font-semibold hover:bg-chalk">{t(lang, "find_a_part")}</Link>
          <NavDropdown
            trigger={<>{t(lang, "nav_sections")}<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-data-[open=true]:rotate-180"><path d="M6 9l6 6 6-6" /></svg></>}
            triggerClassName="flex min-h-12 cursor-pointer items-center gap-1 rounded-lg px-4 text-[15px] font-semibold hover:bg-chalk"
            panelClassName="absolute start-0 top-full z-30 grid max-h-[70vh] w-[min(92vw,640px)] grid-cols-2 gap-1 overflow-auto rounded-xl border border-line bg-white p-3 shadow-lg sm:grid-cols-3"
          >
            {categories.map((c) => (
                <Link key={c.id} href={`/search?category=${encodeURIComponent(c.id)}`} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-chalk">{pickName(lang, c.nameEn, c.nameAr)}</Link>
              ))}
            <Link href="/search" className="rounded-lg px-3 py-2.5 text-sm font-bold text-navy underline hover:bg-chalk">{t(lang, "all_sections")}</Link>
          </NavDropdown>
        </div>
      </nav>
      <VehicleBar />
      {!reachable && <p role="alert" className="bg-[#a12a21] px-4 py-2 text-center text-sm font-semibold text-white">{t(lang, "shop_unreachable")}</p>}
      <div className="bg-signal text-sm font-semibold text-on-signal">
        <div className="mx-auto flex min-h-10 max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-1 px-4 py-1 sm:px-8">
          <span>{t(lang, "announce_warehouse")}</span>
          <span>{t(lang, "announce_shipping")}</span>
        </div>
      </div>
    </header>
  );
}
