import Image from "next/image";
import Link from "@/components/LocLink";
import { t, type DictKey, type Lang } from "@/lib/i18n";

// The legal pages live on the existing Leap website (the policies are written and kept there); this links to them in the visitor's language rather than copying them.
// Set NEXT_PUBLIC_LEGAL_BASE_URL if they move. (Odoo serves Arabic under /ar, and the privacy page's real address is spelled "privecy-policy".)
const LEGAL_BASE = (process.env.NEXT_PUBLIC_LEGAL_BASE_URL || "https://www.leapautoparts.com").replace(/\/+$/, "");
const LEGAL: Array<[DictKey, string]> = [["about_us", "about-us"], ["terms", "terms-conditions"], ["delivery_shipping", "delivery-shipping-policy"], ["refund_policy", "refund-policy"], ["privacy_policy", "privecy-policy"], ["cancellation_policy", "cancellation-replacement-policy"]];
const ACCOUNT: Array<[DictKey, string]> = [["my_orders", "/orders"], ["returns", "/returns"], ["wishlist", "/wishlist"], ["saved_searches", "/saved-searches"], ["garage_title", "/garage"], ["addresses", "/addresses"], ["referrals", "/referrals"]];

const head = "mb-3 text-sm font-bold uppercase tracking-wider text-signal";
const link = "block py-1.5 text-[15px] hover:underline";

export default function SiteFooter({ lang }: { lang: Lang }) {
  const legalPrefix = lang === "ar" ? `${LEGAL_BASE}/ar` : LEGAL_BASE;
  return (
    <footer className="mt-16 bg-navy-deep text-[#e6edf2]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <Image src="/leap-logo.png" alt="Leap Auto Parts" width={64} height={64} className="rounded-full" />
          <p className="mt-3 max-w-56 text-[#a9bac6]">{t(lang, "footer_tagline")}</p>
        </div>
        <nav aria-label={t(lang, "footer_shop")}>
          <h3 className={head}>{t(lang, "footer_shop")}</h3>
          <Link href="/" className={link}>{t(lang, "nav_home")}</Link>
          <Link href="/search" className={link}>{t(lang, "nav_products")}</Link>
        </nav>
        <nav aria-label={t(lang, "footer_my_account")}>
          <h3 className={head}>{t(lang, "footer_my_account")}</h3>
          {ACCOUNT.map(([key, href]) => <Link key={href} href={href} className={link}>{t(lang, key)}</Link>)}
        </nav>
        <nav aria-label={t(lang, "footer_help")}>
          <h3 className={head}>{t(lang, "footer_help")}</h3>
          <Link href="/support" className={link}>{t(lang, "support")}</Link>
        </nav>
        <nav aria-label={t(lang, "footer_useful_links")}>
          <h3 className={head}>{t(lang, "footer_useful_links")}</h3>
          {LEGAL.map(([key, slug]) => <a key={slug} href={`${legalPrefix}/${slug}`} className={link}>{t(lang, key)}</a>)}
        </nav>
      </div>
      <div className="border-t border-[#1b3a4d]">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-4 py-5 text-[13px] text-[#a9bac6] sm:px-8">
          <span>{t(lang, "copyright", { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </footer>
  );
}
