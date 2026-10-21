import Image from "next/image";
import Link from "@/components/LocLink";
import FooterSocial from "@/components/FooterSocial";
import { fetchFooterContent } from "@/lib/api";
import { PAGE_KEYS, PAGE_SLUGS, formatCopyright, type TitleKey } from "@/lib/footerContent";
import { pickHomeText } from "@/lib/homeText";
import { t, type DictKey, type Lang } from "@/lib/i18n";

// The six pages (About us, Terms, ...) are written in the admin portal and live INSIDE the storefront. Until a page has text, its link keeps going to the same page on the existing Leap website, in the visitor's language,
// so no link is ever empty while the pages are being filled in.
// Set NEXT_PUBLIC_LEGAL_BASE_URL if they move. (Odoo serves Arabic under /ar, and the privacy page's real address is spelled "privecy-policy".)
const LEGAL_BASE = (process.env.NEXT_PUBLIC_LEGAL_BASE_URL || "https://www.leapautoparts.com").replace(/\/+$/, "");
const LEGAL: Array<[DictKey, string]> = [["about_us", "about-us"], ["terms", "terms-conditions"], ["delivery_shipping", "delivery-shipping-policy"], ["refund_policy", "refund-policy"], ["privacy_policy", "privecy-policy"], ["cancellation_policy", "cancellation-replacement-policy"]];
const ACCOUNT: Array<[DictKey, string]> = [["account_hub_title", "/account"], ["my_orders", "/orders"], ["returns", "/returns"], ["wishlist", "/wishlist"], ["saved_searches", "/saved-searches"], ["garage_title", "/garage"], ["addresses", "/addresses"], ["referrals", "/referrals"]];

const head = "mb-3 text-sm font-bold uppercase tracking-wider text-signal";
const link = "block py-1.5 text-[15px] hover:underline";

export default async function SiteFooter({ lang }: { lang: Lang }) {
  const footer = await fetchFooterContent();      // what the admin set (texts, social media icons, which pages have text); null = the website's own footer
  const title = (k: TitleKey, key: DictKey) => pickHomeText(footer?.text.titles[k], lang, t(lang, key));
  const year = new Date().getFullYear();
  const legalPrefix = lang === "ar" ? `${LEGAL_BASE}/ar` : LEGAL_BASE;
  return (
    <footer id="site-footer" className="mt-16 bg-navy-deep text-[#e6edf2]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <Image src="/leap-logo.png" alt="Leap Auto Parts" width={64} height={64} className="rounded-full" />
          <p className="mt-3 max-w-56 text-[#a9bac6]">{pickHomeText(footer?.text.tagline, lang, t(lang, "footer_tagline"))}</p>
          <FooterSocial items={footer?.social ?? []} label={t(lang, "footer_social")} />
        </div>
        <nav aria-label={title("shop", "footer_shop")}>
          <h3 className={head}>{title("shop", "footer_shop")}</h3>
          <Link href="/" className={link}>{t(lang, "nav_home")}</Link>
          <Link href="/search" className={link}>{t(lang, "nav_products")}</Link>
        </nav>
        <nav aria-label={title("account", "footer_my_account")}>
          <h3 className={head}>{title("account", "footer_my_account")}</h3>
          {ACCOUNT.map(([key, href]) => <Link key={href} href={href} className={link}>{t(lang, key)}</Link>)}
        </nav>
        <nav aria-label={title("help", "footer_help")}>
          <h3 className={head}>{title("help", "footer_help")}</h3>
          <Link href="/support" className={link}>{t(lang, "support")}</Link>
          <Link href="/contact" className={link}>{t(lang, "contact_us_title")}</Link>
        </nav>
        <nav aria-label={title("useful", "footer_useful_links")}>
          <h3 className={head}>{title("useful", "footer_useful_links")}</h3>
          {LEGAL.map(([label, oldSlug], i) => {
            const key = PAGE_KEYS[i];
            const setting = footer?.text.links[key];
            if (setting && setting.shown === false) return null;                       // the admin hid this link
            const text = pickHomeText(setting, lang, t(lang, label));
            return footer?.pages[key]
              ? <Link key={key} href={`/${PAGE_SLUGS[key]}`} className={link}>{text}</Link>
              : <a key={key} href={`${legalPrefix}/${oldSlug}`} className={link}>{text}</a>;
          })}
        </nav>
      </div>
      <div className="border-t border-[#1b3a4d]">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-4 py-5 text-[13px] text-[#a9bac6] sm:px-8">
          <span>{formatCopyright(footer?.text.copyright, lang, year, t(lang, "copyright", { year }))}</span>
        </div>
      </div>
    </footer>
  );
}
