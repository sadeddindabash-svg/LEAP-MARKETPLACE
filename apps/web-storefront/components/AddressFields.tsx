"use client";

import { useState } from "react";
import { COUNTRIES, countryName, findCountry } from "@/lib/countries";
import { SAUDI_NATIONAL_ADDRESS, isSaudi, type AddressFields } from "@/lib/address";
import { currentPosition, reverseGeocode } from "@/lib/nominatim";
import { useLang, useT } from "./LangProvider";

const input = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";
const labelClass = "mb-1.5 block text-[13px] font-bold text-navy";

type Located = "idle" | "finding" | "found" | "failed";

/**
 * The address form, with the mobile app's rules: a country from the countries we serve, the Saudi address code (four letters and four numbers) only for Saudi Arabia, and "Use my
 * location" to fill the street (with the district), the city, the region, the postal code and the country in, each in its own field and in the page's language, lightly
 * green until the buyer edits them (the same lookup the app uses; if it cannot, the buyer just types).
 */
export default function AddressForm({ value, onChange, withLabel = false, idPrefix, disabled = false }: { value: AddressFields; onChange: (next: AddressFields) => void; withLabel?: boolean; idPrefix: string; disabled?: boolean }) {
  const lang = useLang();
  const t = useT();
  const [located, setLocated] = useState<Located>("idle");
  const [foreign, setForeign] = useState(false);          // the lookup found a country we do not serve
  // The fields "Use my location" filled, lightly green so the buyer checks them; a field the buyer then edits is theirs again.
  const [filled, setFilled] = useState<ReadonlySet<keyof AddressFields>>(new Set());
  const set = (patch: Partial<AddressFields>) => {
    if (Object.keys(patch).some((k) => filled.has(k as keyof AddressFields))) setFilled((cur) => { const n = new Set(cur); for (const k of Object.keys(patch)) n.delete(k as keyof AddressFields); return n; });
    onChange({ ...value, ...patch });
  };

  const locate = async () => {
    setLocated("finding"); setForeign(false);
    const position = await currentPosition();
    const found = position ? await reverseGeocode(position.latitude, position.longitude, fetch, lang === "ar" ? "ar" : "en") : null;
    if (!found) return setLocated("failed");
    const country = findCountry(found.countryCode) ?? findCountry(found.country);
    setForeign(!country && !!(found.country || found.countryCode));
    // Each piece in its own field; a piece the map does not have leaves what the buyer typed.
    const next: AddressFields = { ...value, streetAddress: found.streetAddress || value.streetAddress, city: found.city || value.city, state: found.state || value.state, postalCode: found.postalCode || value.postalCode, country: country?.en ?? "" };
    onChange(next);
    setFilled(new Set((["streetAddress", "city", "state", "postalCode", "country"] as const).filter((k) => k === "country" ? !!country : !!found[k])));
    setLocated("found");
  };

  const codeInvalid = isSaudi(value.country) && value.nationalAddress.length > 0 && !SAUDI_NATIONAL_ADDRESS.test(value.nationalAddress);
  const field = (name: keyof AddressFields, label: string, extra: { type?: string; maxLength?: number; dir?: "ltr" } = {}) => (
    <div>
      <label htmlFor={`${idPrefix}-${name}`} className={labelClass}>{label}</label>
      <input id={`${idPrefix}-${name}`} className={`${input} ${filled.has(name) ? "border-[#1e9d6b] bg-[#f0faf5]" : ""}`} data-filled={filled.has(name) || undefined} value={value[name]} disabled={disabled} type={extra.type ?? "text"} maxLength={extra.maxLength} dir={extra.dir}
        onChange={(e) => set({ [name]: e.target.value } as Partial<AddressFields>)} />
    </div>
  );

  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={locate} disabled={disabled || located === "finding"} className="inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50">
          {located === "finding" ? t("finding_location") : t("use_my_location")}
        </button>
        <p aria-live="polite" className="text-sm text-muted">
          {located === "found" && t("address_found_hint")}
          {located === "failed" && t("address_undetected_hint")}
        </p>
      </div>
      {withLabel && <div className="sm:col-span-2">{field("label", t("label_field"))}</div>}
      {field("recipientName", t("recipient_name_field"))}
      {field("phone", t("phone_field"), { type: "tel", dir: "ltr" })}
      <div>
        <label htmlFor={`${idPrefix}-country`} className={labelClass}>{t("country_field")}</label>
        <select id={`${idPrefix}-country`} className={`${input} ${filled.has("country") ? "border-[#1e9d6b] bg-[#f0faf5]" : ""}`} data-filled={filled.has("country") || undefined} value={value.country} disabled={disabled} onChange={(e) => { setForeign(false); set({ country: e.target.value }); }}>
          <option value="">{t("choose_country")}</option>
          {COUNTRIES.map((c) => <option key={c.code} value={c.en}>{countryName(lang, c.en)}</option>)}
        </select>
        {foreign && <p role="alert" className="mt-1.5 text-sm font-semibold text-[#a12a21]">{t("country_not_served")}</p>}
      </div>
      {field("state", t("state_field"))}
      {field("city", t("city_field"))}
      {field("postalCode", t("postal_code_field"), { dir: "ltr" })}
      <div className="sm:col-span-2">{field("streetAddress", t("street_address_field"))}</div>
      {isSaudi(value.country) && (
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-nationalAddress`} className={labelClass}>{t("national_address_field")}</label>
          <input id={`${idPrefix}-nationalAddress`} className={`${input} font-plate uppercase`} value={value.nationalAddress} maxLength={8} dir="ltr" disabled={disabled} aria-invalid={codeInvalid}
            onChange={(e) => set({ nationalAddress: e.target.value })} />
          {codeInvalid && <p role="alert" className="mt-1.5 text-sm font-semibold text-[#a12a21]">{t("national_address_format_error")}</p>}
        </div>
      )}
    </div>
  );
}
