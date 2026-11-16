"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/LocLink";
import PhotoBox from "@/components/PhotoBox";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { useT } from "@/components/LangProvider";
import { splitLang } from "@/lib/i18n";

/**
 * The bottom menu on a phone (under 768 px; confirmed with the person via mockup, design B "like the app"): Home · Sections · Search · Cart · Account, always on screen.
 * "Sections" opens a panel above the menu with every section (4 per line, with its photo) and "All sections"; it closes when a section is chosen, on the dimmed
 * background, with Escape, or when the page changes. The cart shows its number. Account opens the account (or Sign in when signed out).
 * Not shown from 768 px up (the header's own menu is there). Right to left in Arabic by itself.
 * The liquid indicator (confirmed with the person via mockup): the bar is navy and bulges up under the chosen tab like a drop; the drop stretches as it slides
 * to the next tab and the gold circle under it shrinks and pops back, holding that tab's icon. On a page that is none of the five, there is no drop.
 * A phone set to reduce motion just switches, without movement.
 */
type Section = { id: string; name: string; photoUrl?: string | null };

const icon = (d: React.ReactNode) => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const ICONS = {
  home: icon(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h5v-6h4v6h5V10" /></>),
  sections: icon(<><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></>),
  search: icon(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>),
  cart: icon(<><path d="M4 5h2l2 10h9l2-7H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>),
  account: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
};

const tab = "relative z-[1] flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold";
const TABS = 5;
const LIQUID_CSS = `@keyframes leap-liquid-stretch { 0% { transform: scale(1, 1); } 40% { transform: scale(1.55, .72); } 75% { transform: scale(.9, 1.12); } 100% { transform: scale(1, 1); } }
@keyframes leap-liquid-pop { 0% { transform: scale(1); } 35% { transform: scale(.55); } 80% { transform: scale(1.08); } 100% { transform: scale(1); } }
.leap-liquid > svg { transform-origin: 50% 100%; animation: leap-liquid-stretch .2s cubic-bezier(.65,0,.25,1); }
.leap-liquid > span { animation: leap-liquid-pop .2s cubic-bezier(.65,0,.25,1); }
@media (prefers-reduced-motion: reduce) { .leap-liquid > svg, .leap-liquid > span { animation: none; } .leap-liquid-move, .leap-liquid-icon { transition: none !important; } }`;

export default function MobileTabBar({ sections }: { sections: Section[] }) {
  const t = useT();
  const { user } = useAuth();
  const { itemCount } = useCart();
  const here = splitLang(usePathname() || "/").path;
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [here]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const color = (on: boolean) => (on ? "text-signal" : "text-[#9fb3c2]");
  // the icon of the chosen tab rises into the gold circle
  const lift = (on: boolean, node: React.ReactNode) => <span className={`leap-liquid-icon transition-transform duration-[164ms] ease-[cubic-bezier(.65,0,.25,1)] ${on ? "-translate-y-[13px] text-navy" : ""}`}>{node}</span>;
  const is = (p: string) => (p === "/" ? here === "/" : here === p || here.startsWith(`${p}/`));
  const accountHref = user ? "/account" : "/login";
  const active = open ? 1 : is("/") ? 0 : is("/search") ? 2 : is("/cart") ? 3 : is("/account") ? 4 : -1;

  return (
    <div data-testid="mobile-tab-bar" className="md:hidden">
      {open && (
        <>
          <button type="button" aria-label={t("cancel")} onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-[#07202f]/40" />
          <div id="mobile-sections" role="dialog" aria-label={t("nav_sections")} className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 max-h-[65vh] overflow-auto rounded-t-2xl border-t border-line bg-white p-4 shadow-[0_-8px_24px_rgba(7,32,47,0.18)]">
            <p className="mb-3 text-base font-extrabold text-ink">{t("nav_sections")}</p>
            <ul className="grid grid-cols-4 gap-x-2 gap-y-3">
              {sections.map((s) => (
                <li key={s.id}>
                  <Link href={`/search?category=${encodeURIComponent(s.id)}`} onClick={() => setOpen(false)} className="flex flex-col items-center gap-1.5 text-center">
                    <PhotoBox src={s.photoUrl} className="aspect-square w-full" sizes="90px" />
                    <span className="line-clamp-2 w-full text-[11.5px] font-bold leading-tight [overflow-wrap:anywhere]">{s.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/search" onClick={() => setOpen(false)} className="mt-4 flex h-11 items-center justify-center rounded-xl border border-line text-sm font-bold text-navy">{t("all_sections")}</Link>
          </div>
        </>
      )}
      <nav aria-label={t("nav_sections") + " · " + t("account")} className="fixed inset-x-0 bottom-0 z-50 flex bg-navy pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(7,32,47,0.18)]">
        <style>{LIQUID_CSS}</style>
        {/* the liquid drop and the gold circle under the chosen tab */}
        <div aria-hidden="true" data-testid="liquid-indicator" className={`pointer-events-none absolute inset-x-0 top-0 transition-opacity duration-300 ${active < 0 ? "opacity-0" : ""}`}>
          <div className="leap-liquid-move absolute top-0 -ms-[55px] w-[110px] transition-[inset-inline-start] duration-[200ms] ease-[cubic-bezier(.65,0,.25,1)]" style={{ insetInlineStart: `${(Math.max(active, 0) + 0.5) * (100 / TABS)}%` }}>
            <div key={active} className="leap-liquid relative">
              <svg width="110" height="22" viewBox="0 0 110 22" className="absolute -top-[21px] left-0 block"><path d="M0 22C25 22 30 0 55 0S85 22 110 22Z" fill="#0b3146" /></svg>
              <span className="absolute -top-4 left-1/2 -ml-[23px] block size-[46px] rounded-full bg-signal shadow-[0_6px_16px_rgba(249,179,23,0.45)]" />
            </div>
          </div>
        </div>
        <Link href="/" aria-current={is("/") ? "page" : undefined} className={`${tab} ${color(active === 0)}`}>{lift(active === 0, ICONS.home)}<span>{t("nav_home")}</span></Link>
        <button type="button" aria-expanded={open} aria-controls="mobile-sections" onClick={() => setOpen(!open)} className={`${tab} ${color(active === 1)}`}>{lift(active === 1, ICONS.sections)}<span>{t("nav_sections")}</span></button>
        <Link href="/search" aria-current={is("/search") ? "page" : undefined} className={`${tab} ${color(active === 2)}`}>{lift(active === 2, ICONS.search)}<span>{t("search_button")}</span></Link>
        <Link href="/cart" aria-current={is("/cart") ? "page" : undefined} className={`${tab} ${color(active === 3)}`}>
          {lift(active === 3, ICONS.cart)}<span>{t("cart")}</span>
          {itemCount > 0 && <span className={`leap-liquid-icon absolute top-1.5 start-[calc(50%+4px)] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#d93025] px-1 text-[10.5px] font-extrabold text-white ring-2 ring-navy transition-transform duration-[164ms] ${active === 3 ? "-translate-y-[13px]" : ""}`}>{itemCount}</span>}
        </Link>
        <Link href={accountHref} aria-current={is("/account") ? "page" : undefined} className={`${tab} ${color(active === 4)}`}>{lift(active === 4, ICONS.account)}<span>{t("account")}</span></Link>
      </nav>
    </div>
  );
}
