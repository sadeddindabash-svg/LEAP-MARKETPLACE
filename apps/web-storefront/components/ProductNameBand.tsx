import type { Lang } from "@/lib/i18n";

/**
 * The product page's name in a navy band (patch-product-name-band, option 6 "Navy title band", confirmed with the person via mockup):
 *   the part's name large in white; under it, on one line, the car it fits and the versions with the years in soft blue, and the part number
 *   in a gold pill at the end (patch-product-name-compact: a shorter band).
 * The parts come from the server's fitTitle (patch-name-car-part). Without it (an older server) the plain name is shown, with the part number
 * when the product has one.
 */
export interface NameBandTitle {
  name: string;
  partNumber?: string | null;
  allCars?: boolean;
  brand?: string | null;
  model?: string | null;
  allVersions?: boolean;
  versions?: string[];
  versionCount?: number;
  yearFrom?: number | null;
  yearTo?: number | null;
  moreCars?: number;
}

const WORDS = {
  en: { allVersions: "All versions", allCars: "All cars", versions: (n: number) => `${n} versions`, more: (n: number) => (n === 1 ? "+ 1 more car" : `+ ${n} more cars`), pn: "Part No." },
  ar: { allVersions: "جميع الفئات", allCars: "جميع السيارات", versions: (n: number) => `${n} فئات`, more: (n: number) => (n === 1 ? "+ سيارة أخرى" : n === 2 ? "+ سيارتان أخريان" : `+ ${n} سيارات أخرى`), pn: "رقم القطعة" },
};

export function nameBandParts(title: NameBandTitle | null | undefined, name: string, lang: Lang, fallbackPartNumber?: string | null) {
  const w = WORDS[lang === "ar" ? "ar" : "en"];
  const pn = (title ? title.partNumber : fallbackPartNumber)?.trim() || null;
  if (!title) return { name, car: null as string | null, years: null as string | null, more: null as string | null, pn };
  let car: string | null = null;
  let years: string | null = null;
  let more: string | null = null;
  if (title.allCars) car = w.allCars;
  else if (title.brand || title.model) {
    const listed = title.versions ?? [];
    const count = title.versionCount ?? listed.length;
    const version = title.allVersions || count === 0 ? w.allVersions : count > listed.length ? w.versions(count) : listed.join(" / ");
    car = `${[title.brand, title.model].filter(Boolean).join(" ")} · ${version}`;
    if (title.yearFrom) years = title.yearTo && title.yearTo !== title.yearFrom ? `(${title.yearFrom}–${title.yearTo})` : `(${title.yearFrom})`;
    if ((title.moreCars ?? 0) > 0) more = w.more(title.moreCars!);
  }
  return { name: title.name || name, car, years, more, pn };
}

export default function ProductNameBand({ title, name, lang, partNumber }: { title?: NameBandTitle | null; name: string; lang: Lang; partNumber?: string | null }) {
  const p = nameBandParts(title, name, lang, partNumber);
  const w = WORDS[lang === "ar" ? "ar" : "en"];
  return (
    <>
      <span data-testid="name-band-name" className="block text-[20px] font-bold leading-[1.3] tracking-tight text-white lg:text-[24px]">{p.name}</span>
      {(p.car || p.pn) && (
        <span className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {p.car ? (
            <span data-testid="name-band-car" className="min-w-0 text-[14.5px] font-medium leading-snug text-[#9fb4c3]">
              {p.car}
              {p.years && <> <bdi dir="ltr" className="whitespace-nowrap">{p.years}</bdi></>}
              {p.more && <> · {p.more}</>}
            </span>
          ) : <span />}
          {p.pn && (
            <span data-testid="name-band-pn" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-signal px-2.5 py-0.5 text-[12.5px] font-bold leading-5 text-on-signal">
              <span>{w.pn}</span>
              <bdi dir="ltr" className="font-plate">{p.pn}</bdi>
            </span>
          )}
        </span>
      )}
    </>
  );
}
