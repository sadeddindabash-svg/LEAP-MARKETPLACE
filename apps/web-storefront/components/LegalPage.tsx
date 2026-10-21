import type { Metadata } from "next";
import Link from "@/components/LocLink";
import RichText from "@/components/RichText";
import { fetchLegalPage } from "@/lib/api";
import { PAGE_SLUGS, pageText, type PageKey } from "@/lib/footerContent";
import { t, type DictKey, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { plainText } from "@/lib/miniMarkdown";
import { alternatesFor } from "@/lib/seo";

// One of the six pages (About us, Terms & Conditions, Delivery & Shipping, Refund, Privacy Policy, Cancellation): the title and the text the admin wrote, in the visitor's language. A page that has no text yet says so
// (and is kept out of search engines) instead of showing an empty page.
const NAME: Record<PageKey, DictKey> = { about: "about_us", terms: "terms", delivery: "delivery_shipping", refund: "refund_policy", privacy: "privacy_policy", cancellation: "cancellation_policy" };
const when = (iso: string, lang: Lang) => new Date(iso).toLocaleDateString(lang === "ar" ? "ar-u-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

export async function legalMetadata(key: PageKey): Promise<Metadata> {
  const lang = await getLang(); const page = await fetchLegalPage(key);
  const title = (page && pageText(page.title, lang)) || t(lang, NAME[key]);
  const description = page?.hasContent ? plainText(pageText(page.body, lang)).slice(0, 155) : undefined;
  // the site's name is added after the title by the layout itself (its title template), so only the page's own title is given here
  return { title, description, alternates: alternatesFor(lang, `/${PAGE_SLUGS[key]}`), robots: page?.hasContent ? undefined : { index: false, follow: true } };
}
export default async function LegalPage({ pageKey }: { pageKey: PageKey }) {
  const lang = await getLang(); const page = await fetchLegalPage(pageKey);
  const title = (page && pageText(page.title, lang)) || t(lang, NAME[pageKey]);
  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight text-navy">{title}</h1>
      {page?.hasContent ? (
        <>
          {page.updatedAt && <p className="mt-2 text-sm text-muted">{t(lang, "legal_updated", { date: when(page.updatedAt, lang) })}</p>}
          <RichText source={pageText(page.body, lang)} />
        </>
      ) : (
        <>
          <p className="mt-6 text-lg text-muted">{t(lang, "legal_preparing")}</p>
          <p className="mt-6"><Link href="/" className="font-bold text-navy underline underline-offset-4">{t(lang, "nav_home")}</Link></p>
        </>
      )}
    </article>
  );
}
