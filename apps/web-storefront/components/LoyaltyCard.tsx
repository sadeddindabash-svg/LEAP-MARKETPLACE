"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocLink";
import { fetchLoyaltyStatus, type LoyaltyStatus } from "@/lib/api";
import { memberLabel, progressFraction, tierColor, tierIcon, tierName, type TierIcon } from "@/lib/loyalty";
import { getAuthToken } from "./AuthProvider";
import { useLang, useT } from "./LangProvider";
import { Price } from "./Price";

export function TierBadge({ icon, color, size = 44 }: { icon: TierIcon; color: string; size?: number }) {
  const paths: Record<TierIcon, string> = {
    award: "M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 13.5L7 21l5-3 5 3-1.5-7.5",
    diamond: "M6 4h12l4 6-10 11L2 10l4-6zM2 10h20",
    crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z",
    star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
    medal: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14.5L7 21l5-2.5 5 2.5-1.5-6.5",
  };
  return (
    <span className="grid flex-none place-items-center rounded-full" style={{ width: size, height: size, backgroundColor: `${color}26`, color }} aria-hidden="true">
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[icon]} /></svg>
    </span>
  );
}

/** The loyalty card of the account hub, like the app's: the tier, its discount, and how far it is to the next one. Not shown when the buyer has no tier. */
export default function LoyaltyCard() {
  const lang = useLang();
  const t = useT();
  const [status, setStatus] = useState<LoyaltyStatus | null | undefined>(undefined);
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchLoyaltyStatus(token).then((s) => { if (current) setStatus(s); }).catch(() => { if (current) setStatus(null); });
    return () => { current = false; };
  }, []);
  if (!status || !status.currentTier) return null;
  const tier = status.currentTier, next = status.nextTier;
  const color = tierColor(tier.color);
  return (
    <section className="rounded-[14px] border border-line bg-white p-5" aria-labelledby="loy-h">
      <div className="flex items-center gap-4">
        <TierBadge icon={tierIcon(tier.icon)} color={color} />
        <div className="min-w-0 flex-1">
          <h2 id="loy-h" className="text-lg font-bold">{memberLabel(lang, tierName(lang, tier), t("loyalty_membership_word"))}</h2>
          <p className="text-sm text-muted">{tier.discountPercentage > 0 ? `${tier.discountPercentage}% ${t("loyalty_off_every_order")}` : t("loyalty_keep_spending")}</p>
        </div>
        <Link href="/account/loyalty" className="text-sm font-bold text-navy underline underline-offset-4">{t("loyalty_card_link")}</Link>
      </div>
      {next && status.amountToNextTier != null && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[#dce5eb]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressFraction(status) * 100)}>
            <div className="h-full rounded-full" style={{ width: `${progressFraction(status) * 100}%`, backgroundColor: color }} />
          </div>
          <p className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted"><span><Price usd={status.lifetimeSpend} /> {t("loyalty_spent")}</span><span><Price usd={status.amountToNextTier} /> {t("loyalty_to_next_tier")} {tierName(lang, next)}</span></p>
        </div>
      )}
    </section>
  );
}
