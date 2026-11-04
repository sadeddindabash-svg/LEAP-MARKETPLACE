import type { Metadata } from "next";
import FindTools, { type FindTab } from "@/components/FindTools";
import { fetchCategories } from "@/lib/api";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { alternatesFor } from "@/lib/seo";

const TABS: readonly FindTab[] = ["vehicle", "vin", "part", "symptom"];

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, "find_title"), description: t(lang, "find_lead"), alternates: alternatesFor(lang, "/find") };
}

// "Find the right part": four ways in (the car, the VIN, a part number, what is wrong), the same four the mobile app has. The sections come from the server, in the page's language.
export default async function FindPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const lang = await getLang();
  const { tab } = await searchParams;
  const categories = await fetchCategories();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
      <h1 className="text-[clamp(30px,4vw,44px)] font-bold tracking-tight text-navy">{t(lang, "find_title")}</h1>
      <p className="mb-8 mt-2 max-w-2xl text-lg text-muted">{t(lang, "find_lead")}</p>
      <FindTools categories={categories} initialTab={TABS.includes(tab as FindTab) ? (tab as FindTab) : "vehicle"} />
    </div>
  );
}
