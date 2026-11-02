import type { Metadata } from "next";
import Link from "@/components/LocLink";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { alternatesFor } from "@/lib/seo";

// Contact us, like the app's Contact us screen: the two ways to reach us that really exist, support (a ticket, a conversation with the Leap team) and a bug
// report. No email address or phone number is shown: none is set up anywhere, and a made-up one would be worse than none. Open to everyone, and indexed.
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, "contact_us_title"), description: t(lang, "support_meta_description"), alternates: alternatesFor(lang, "/contact") };
}

const CHAT = ["M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"];
const BUG = ["M8 6a4 4 0 0 1 8 0", "M6 10h12v5a6 6 0 0 1-12 0z", "M12 10v11", "M3 13h3M18 13h3M4 7l2.5 2M20 7l-2.5 2M4 20l2.5-2.5M20 20l-2.5-2.5"];

export default async function ContactPage() {
  const lang = await getLang();
  const ways: Array<{ href: string; title: string; sub: string; paths: string[] }> = [
    { href: "/support", title: t(lang, "support"), sub: t(lang, "contact_support_sub"), paths: CHAT },
    { href: "/report-bug", title: t(lang, "report_bug_title"), sub: t(lang, "contact_bug_sub"), paths: BUG },
  ];
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t(lang, "contact_us_title")}</h1>
      <p data-page-lead="" className="mt-2 text-muted">{t(lang, "contact_page_lead")}</p>
      <ul className="mt-6 grid gap-3">
        {ways.map((w) => (
          <li key={w.href}>
            <Link href={w.href} className="flex items-center gap-4 rounded-[14px] border border-line bg-white p-5 transition-colors hover:border-navy">
              <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#fff4d6] text-navy">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{w.paths.map((d) => <path key={d} d={d} />)}</svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold text-navy">{w.title}</span>
                <span className="block text-sm text-muted">{w.sub}</span>
              </span>
              <span aria-hidden="true" className="text-xl text-muted rtl:rotate-180">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
