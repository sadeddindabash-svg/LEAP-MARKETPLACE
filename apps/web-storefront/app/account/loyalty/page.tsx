"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocLink";
import { TierBadge } from "@/components/LoyaltyCard";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { Price } from "@/components/Price";
import { fetchLoyaltyStatus, type LoyaltyStatus } from "@/lib/api";
import { memberLabel, tierColor, tierIcon, tierName } from "@/lib/loyalty";

// My tier: where the buyer stands, what they have spent, and every tier with what unlocks it (the app's loyalty detail screen).
export default function LoyaltyPage() {
  const { user, isLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const [status, setStatus] = useState<LoyaltyStatus | null | undefined>(undefined);
  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchLoyaltyStatus(token).then((s) => { if (current) setStatus(s); }).catch(() => { if (current) setStatus(null); });
    return () => { current = false; };
  }, [user]);

  if (isLoading || (user && status === undefined)) return <div aria-busy="true">{t("loading_account")}</div>;
  if (!user) return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8"><Link href="/login?next=%2Faccount%2Floyalty" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal">{t("log_in")}</Link></div>;
  if (!status) return <p role="alert" className="font-semibold text-[#a12a21]">{t("loyalty_not_available")}</p>;

  const current = status.currentTier;
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t("loyalty_my_tier_title")}</h1>
      {current && (
        <section className="flex items-center gap-4 rounded-[14px] border border-line bg-white p-5" aria-label={t("loyalty_my_tier_title")}>
          <TierBadge icon={tierIcon(current.icon)} color={tierColor(current.color)} size={56} />
          <div>
            <p className="text-xl font-bold">{memberLabel(lang, tierName(lang, current), t("loyalty_membership_word"))}</p>
            <p className="text-muted">{current.discountPercentage > 0 ? `${current.discountPercentage}% ${t("loyalty_off_every_order")}` : t("loyalty_spend_more")}</p>
            <p className="mt-1 text-sm font-semibold text-muted">{t("loyalty_lifetime_spend")}: <Price usd={status.lifetimeSpend} /></p>
          </div>
        </section>
      )}
      <section aria-labelledby="all-tiers">
        <h2 id="all-tiers" className="mb-3 text-xs font-extrabold uppercase tracking-widest text-[#8a6100]">{t("loyalty_all_tiers")}</h2>
        <ul className="grid gap-2.5">
          {status.allTiers.map((tier) => {
            const isCurrent = current?.id === tier.id;
            const color = tierColor(tier.color);
            return (
              <li key={tier.id} aria-current={isCurrent ? "true" : undefined} className="flex items-center gap-3 rounded-xl border-[1.5px] bg-white p-4" style={{ borderColor: isCurrent ? color : undefined, backgroundColor: isCurrent ? `${color}1a` : undefined }}>
                <TierBadge icon={tierIcon(tier.icon)} color={isCurrent ? color : "#53636f"} size={36} />
                <div className="min-w-0 flex-1">
                  <p className={isCurrent ? "font-bold" : "font-medium"}>{tierName(lang, tier)}{tier.discountPercentage > 0 ? ` — ${tier.discountPercentage}% ${t("loyalty_off_suffix")}` : ""}</p>
                  <p className="text-xs text-muted">{t("loyalty_unlocked_at")} <Price usd={tier.spendThreshold} />+</p>
                </div>
                {isCurrent && <span aria-hidden="true" style={{ color }}>✓</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
