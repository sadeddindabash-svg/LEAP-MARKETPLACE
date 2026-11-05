"use client";

import Link from "@/components/LocLink";
import { useT } from "@/components/LangProvider";

const tab = (on: boolean) => `inline-flex min-h-10 items-center gap-2 rounded-[9px] px-4 text-[13.5px] font-extrabold max-md:px-3 ${on ? "bg-navy text-signal" : "text-[#33424d] hover:bg-chalk"}`;
const badge = (n: number) => <span aria-hidden="true" className="rounded-full bg-signal px-1.5 text-[11.5px] font-extrabold text-navy">{n}</span>;

/**
 * Wishlist's two tabs (design A): Saved parts and Compare. On the wishlist page they are buttons (Compare starts ticking parts); on the
 * comparison page (/compare, a tab of Wishlist) Saved parts is a link back. The numbers are decoration: a button's name stays "Compare".
 */
export function WishlistTabs({ active, savedCount, compareCount, canCompare = true, onSaved, onCompare }: {
  active: "saved" | "compare"; savedCount?: number; compareCount?: number; canCompare?: boolean; onSaved?: () => void; onCompare?: () => void;
}) {
  const t = useT();
  return (
    <div aria-label={t("wishlist")} className="mt-1 inline-flex gap-1.5 rounded-[12px] border border-line bg-white p-1">
      {onSaved
        ? <button type="button" aria-pressed={active === "saved"} onClick={onSaved} className={tab(active === "saved")}>{t("wishlist_tab_saved")}{savedCount ? badge(savedCount) : null}</button>
        : <Link href="/wishlist" className={tab(active === "saved")}>{t("wishlist_tab_saved")}{savedCount ? badge(savedCount) : null}</Link>}
      {canCompare && (onCompare
        ? <button type="button" aria-pressed={active === "compare"} onClick={onCompare} className={tab(active === "compare")}>{t("compare_mode")}{compareCount ? badge(compareCount) : null}</button>
        : <span aria-current="page" className={tab(active === "compare")}>{t("compare_mode")}{compareCount ? badge(compareCount) : null}</span>)}
    </div>
  );
}
