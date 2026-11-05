import type { Metadata } from "next";
import Link from "@/components/LocLink";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { alternatesFor } from "@/lib/seo";

// Contact us, like the app's Contact us screen: the two ways to reach us that really exist, support (a ticket, a conversation with the Leap team) and a bug
// report. No email address or phone number is shown: none is set up anywhere, and a made-up one would be worse than none. Open to everyone, and indexed.
// In the look of the account pages: two cards side by side, each with its icon in a white circle with a gold ring and a gold link, and a light blue note.
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, "contact_us_title"), description: t(lang, "support_meta_description"), alternates: alternatesFor(lang, "/contact") };
}

const CHAT = ["M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"];
const BUG = ["M8 6a4 4 0 0 1 8 0", "M6 10h12v5a6 6 0 0 1-12 0z", "M12 10v11", "M3 13h3M18 13h3M4 7l2.5 2M20 7l-2.5 2M4 20l2.5-2.5M20 20l-2.5-2.5"];

export default async function ContactPage() {
  const lang = await getLang();
  const ways: Array<{ href: string; title: string; sub: string; go: string; paths: string[] }> = [
    { href: "/support", title: t(lang, "support"), sub: t(lang, "contact_support_sub"), go: t(lang, "contact_open_ticket"), paths: CHAT },
    { href: "/report-bug", title: t(lang, "report_bug_title"), sub: t(lang, "contact_bug_sub"), go: t(lang, "contact_report_it"), paths: BUG },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t(lang, "contact_us_title")}</h1>
      <p data-page-lead="" className="mt-2 text-muted">{t(lang, "contact_page_lead")}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {ways.map((w) => (
          <li key={w.href} className="flex">
            <Link href={w.href} className="group flex w-full flex-col items-start gap-2 rounded-[16px] border border-line bg-white p-5 transition-colors hover:border-navy max-md:flex-row max-md:items-center max-md:gap-3 max-md:p-4">
              <span aria-hidden="true" className="mb-1 mt-0.5 grid size-12 flex-none place-items-center rounded-full bg-white text-navy ring-[3px] ring-signal max-md:m-0 max-md:size-11">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{w.paths.map((d) => <path key={d} d={d} />)}</svg>
              </span>
              <span className="flex w-full min-w-0 flex-1 flex-col items-start gap-2 max-md:gap-0.5"><span className="block text-[17px] font-bold text-navy max-md:text-[15.5px]">{w.title}</span>
              <span className="block text-sm text-muted max-md:text-[13px] max-md:leading-snug">{w.sub}</span>
              <span className="mt-auto pt-1 text-sm font-extrabold text-[#8a6100] group-hover:underline max-md:pt-0.5">{w.go} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span></span></span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-[12px] bg-[#e6eef4] px-4 py-3 text-sm font-semibold text-navy"><span aria-hidden="true">ⓘ </span>{t(lang, "support_notice")}</p>
    </div>
  );
}
