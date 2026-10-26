import { pickName, t, type Lang } from "@/lib/i18n";

/** Under the stock box: "Verified seller" and "Ships from China Warehouse" (the country only, never the supplier's name), each only when the server says so. */
export default function SellerSignals({ isVerifiedSeller, shipsFromCountry, shipsFromCountryAr, lang }: { isVerifiedSeller?: boolean; shipsFromCountry?: string | null; shipsFromCountryAr?: string | null; lang: Lang }) {
  if (!isVerifiedSeller && !shipsFromCountry) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
      {isVerifiedSeller && (
        <li className="flex items-center gap-1.5">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#e39f0c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 2.1 3.2-.2.9 3.1 2.7 1.8-1.1 3 1.1 3-2.7 1.8-.9 3.1-3.2-.2L12 22l-2.4-2.1-3.2.2-.9-3.1-2.7-1.8 1.1-3-1.1-3 2.7-1.8.9-3.1 3.2.2z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
          {t(lang, "row_verified")}
        </li>
      )}
      {shipsFromCountry && (
        <li className="flex items-center gap-1.5">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
          {t(lang, "ships_from_warehouse", { country: pickName(lang, shipsFromCountry, shipsFromCountryAr) })}
        </li>
      )}
    </ul>
  );
}
