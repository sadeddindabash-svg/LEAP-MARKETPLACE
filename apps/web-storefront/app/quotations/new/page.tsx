"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocLink";
import SignInPrompt from "@/components/SignInPrompt";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { useGarage } from "@/components/GarageProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useLang, useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";
import { fetchMyAddresses, type SavedAddress } from "@/lib/api";
import { countryName } from "@/lib/countries";
import { pickName } from "@/lib/i18n";
import { PARTY_KEY, PARTY_TYPES, createQuotation, quoteErrorText, sharesFor, type PartyType } from "@/lib/quotations";

const input = "min-h-11 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";
const card = "rounded-[14px] border border-line bg-white p-5";
const chip = (on: boolean) => `inline-flex min-h-10 items-center rounded-full border-[1.5px] px-3.5 text-sm font-semibold ${on ? "border-navy bg-navy text-white" : "border-line text-ink hover:border-navy"}`;
const NAME_KEY = { insurance: "quote_name_insurance", repair_shop: "quote_name_repair_shop", other_party: "quote_name_other_party", employer: "quote_name_employer", other: "quote_name_other" } as const;
const OTHER_CAR = "__other__";

// Get a quotation, from the parts ticked in the cart: the car (from My garage, or typed), who it is for (insurance first), their reference numbers, who
// pays (them, me, or split as an accident share), and where the parts go once ordered. The prices are the server's: nothing typed here changes them.
export default function NewQuotationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const ctx = useCart();
  const { vehicles } = useGarage();
  const { code: currencyCode, format } = useCurrency();
  const lang = useLang();
  const t = useT();
  const router = useLocRouter();
  const chosen = ctx.selected ?? ctx.cart;
  const items = chosen?.items ?? [];

  const [carPick, setCarPick] = useState<string | null>(null);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [partyType, setPartyType] = useState<PartyType>("insurance");
  const [partyName, setPartyName] = useState("");
  const [policy, setPolicy] = useState("");
  const [report, setReport] = useState("");
  const [payMode, setPayMode] = useState<"party" | "buyer" | "split">("party");
  const [partyPercent, setPartyPercent] = useState(75);
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchMyAddresses(token).then((l) => { if (current) setAddresses(l); }).catch(() => { if (current) setAddresses([]); });
    return () => { current = false; };
  }, [user]);

  if (authLoading || ctx.isLoading) return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!user) return <SignInPrompt messageKey="login_for_quotations" next="/quotations/new" />;
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("get_quotation")}</h1>
        <p className="mb-6 mt-3 text-lg text-muted">{t("quote_none_chosen")}</p>
        <Link href="/cart" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("quote_back_cart")}</Link>
      </div>
    );
  }

  const garageKey = (v: (typeof vehicles)[number]) => `${v.generationId}:${v.year}:${v.versionId ?? ""}`;
  const pick = carPick ?? (vehicles[0] ? garageKey(vehicles.find((v) => v.isDefault) ?? vehicles[0]) : OTHER_CAR);
  const garageCar = vehicles.find((v) => garageKey(v) === pick);
  const address = addresses?.find((a) => a.id === (addressId ?? addresses.find((x) => x.isDefault)?.id ?? addresses[0]?.id));
  const estimate = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const pct = Math.min(99, Math.max(1, Math.round(partyPercent || 0)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const vehicle = garageCar
      ? { make: garageCar.brand, model: garageCar.model, year: garageCar.year, vin: vin.trim() || null, plate: plate.trim() || null }
      : { make: make.trim(), model: model.trim(), year: Number(year), vin: vin.trim() || null, plate: plate.trim() || null };
    if (!vehicle.make || !vehicle.model || !vehicle.year) return setError(t("err_quote_vehicle"));
    if (!partyName.trim()) return setError(t("err_quote_party"));
    if (!address) return setError(t("err_quote_address"));
    const token = getAuthToken();
    if (!token) return;
    setBusy(true);
    try {
      const q = await createQuotation(token, {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })), vehicle, partyType, partyName: partyName.trim(),
        policyNumber: policy.trim() || undefined, reportNumber: report.trim() || undefined, shares: sharesFor(payMode, pct), addressId: address.id, lang, displayCurrency: currencyCode,
      });
      router.push(`/quotations/${encodeURIComponent(q.id)}`);
    } catch (err) {
      setError(quoteErrorText(err, t));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-3xl gap-4 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("get_quotation")}</h1>
        <p className="mt-1 text-muted">{t("quote_new_lead")}</p>
      </div>

      <section className={card} aria-labelledby="qn-parts">
        <h2 id="qn-parts" className="text-lg font-bold text-navy">{t("quote_parts_chosen", { n: items.length })}</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {items.map((i) => <li key={i.productId} className="flex justify-between gap-3"><span><bdi>{i.name}</bdi> × {i.quantity}</span><span className="text-muted">{format(i.price * i.quantity)}</span></li>)}
        </ul>
        <Link href="/cart" className="mt-2 inline-block text-sm font-semibold text-navy underline underline-offset-4">{t("quote_back_cart")}</Link>
      </section>

      <section className={card} aria-labelledby="qn-car">
        <h2 id="qn-car" className="text-lg font-bold text-navy">{t("quote_car")}</h2>
        <div className="mt-2 grid gap-2" role="radiogroup">
          {vehicles.map((v) => (
            <label key={garageKey(v)} className={`flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] p-3 ${pick === garageKey(v) ? "border-navy bg-[#f4f8fb]" : "border-line"}`}>
              <input type="radio" name="qn-car" className="size-5 accent-[#0b3146]" checked={pick === garageKey(v)} onChange={() => setCarPick(garageKey(v))} />
              <span className="font-semibold">{pickName(lang, v.brand, v.brandAr)} {pickName(lang, v.model, v.modelAr)} {v.year}</span>
            </label>
          ))}
          {vehicles.length > 0 && (
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] p-3 ${pick === OTHER_CAR ? "border-navy bg-[#f4f8fb]" : "border-line"}`}>
              <input type="radio" name="qn-car" className="size-5 accent-[#0b3146]" checked={pick === OTHER_CAR} onChange={() => setCarPick(OTHER_CAR)} />
              <span className="font-semibold">{t("quote_car_other")}</span>
            </label>
          )}
        </div>
        {pick === OTHER_CAR && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold">{t("quote_make")}<input className={input} value={make} onChange={(e) => setMake(e.target.value)} /></label>
            <label className="grid gap-1 text-sm font-semibold">{t("quote_model")}<input className={input} value={model} onChange={(e) => setModel(e.target.value)} /></label>
            <label className="grid gap-1 text-sm font-semibold">{t("quote_year")}<input className={input} inputMode="numeric" dir="ltr" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
          </div>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">{t("quote_vin")}<input className={`${input} uppercase`} dir="ltr" maxLength={17} value={vin} onChange={(e) => setVin(e.target.value)} /></label>
          <label className="grid gap-1 text-sm font-semibold">{t("quote_plate")}<input className={input} dir="ltr" value={plate} onChange={(e) => setPlate(e.target.value)} /></label>
        </div>
      </section>

      <section className={card} aria-labelledby="qn-for">
        <h2 id="qn-for" className="text-lg font-bold text-navy">{t("quote_for")}</h2>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="qn-for">
          {PARTY_TYPES.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={partyType === p} onClick={() => setPartyType(p)} className={chip(partyType === p)}>{t(PARTY_KEY[p])}</button>
          ))}
        </div>
        <label className="mt-3 grid gap-1 text-sm font-semibold">{t(NAME_KEY[partyType])}<input className={input} value={partyName} onChange={(e) => setPartyName(e.target.value)} /></label>
        <div className="mt-3 grid gap-3 items-start sm:grid-cols-2">
          {partyType === "insurance" && <label className="grid gap-1 text-sm font-semibold">{t("quote_policy")}<input className={input} dir="ltr" value={policy} onChange={(e) => setPolicy(e.target.value)} /></label>}
          <label className="grid gap-1 text-sm font-semibold">{t("quote_report")}<input className={input} dir="ltr" value={report} onChange={(e) => setReport(e.target.value)} /><span className="text-xs font-normal text-muted">{t("quote_report_hint")}</span></label>
        </div>
      </section>

      <section className={card} aria-labelledby="qn-pay">
        <h2 id="qn-pay" className="text-lg font-bold text-navy">{t("quote_who_pays")}</h2>
        <div className="mt-2 grid gap-2" role="radiogroup">
          {(["party", "buyer", "split"] as const).map((m) => (
            <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] p-3 ${payMode === m ? "border-navy bg-[#f4f8fb]" : "border-line"}`}>
              <input type="radio" name="qn-pay" className="size-5 accent-[#0b3146]" checked={payMode === m} onChange={() => setPayMode(m)} />
              <span className="font-semibold">{m === "party" ? t("quote_pays_party", { name: partyName.trim() || t(PARTY_KEY[partyType]) }) : m === "buyer" ? t("quote_pays_me") : t("quote_pays_split")}</span>
            </label>
          ))}
        </div>
        {payMode === "split" && (
          <div className="mt-3 grid gap-2 text-sm">
            <label className="grid grid-cols-[1fr_88px_110px] items-center gap-2"><span><bdi>{partyName.trim() || t(PARTY_KEY[partyType])}</bdi></span>
              <span className="relative"><input className={`${input} pe-7 text-center`} inputMode="numeric" dir="ltr" value={partyPercent} onChange={(e) => setPartyPercent(Number(e.target.value.replace(/\D/g, "").slice(0, 2)) || 0)} /><span className="absolute end-3 top-1/2 -translate-y-1/2 text-muted">%</span></span>
              <span className="text-muted">{format((estimate * pct) / 100)}</span></label>
            <p className="grid grid-cols-[1fr_88px_110px] items-center gap-2"><span>{t("quote_payer_buyer")}</span><span className="text-center font-semibold">{100 - pct}%</span><span className="text-muted">{format((estimate * (100 - pct)) / 100)}</span></p>
          </div>
        )}
      </section>

      <section className={card} aria-labelledby="qn-to">
        <h2 id="qn-to" className="text-lg font-bold text-navy">{t("quote_delivery")}</h2>
        {addresses === null ? <p className="mt-2 text-muted" aria-busy="true">{t("search_loading")}</p> : addresses.length === 0 ? (
          <p className="mt-2 text-muted">{t("quote_no_address")} <Link href="/addresses" className="font-semibold text-navy underline underline-offset-4">{t("quote_add_address")}</Link></p>
        ) : (
          <div className="mt-2 grid gap-2" role="radiogroup">
            {addresses.map((a) => (
              <label key={a.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3 ${address?.id === a.id ? "border-navy bg-[#f4f8fb]" : "border-line"}`}>
                <input type="radio" name="qn-to" className="mt-0.5 size-5 accent-[#0b3146]" checked={address?.id === a.id} onChange={() => setAddressId(a.id)} />
                <span><span className="block font-semibold"><bdi>{a.label}</bdi> · <bdi>{a.recipientName}</bdi></span><span className="block text-sm text-muted"><bdi>{a.streetAddress}, {a.city}</bdi>, {countryName(lang, a.country)}</span></span>
              </label>
            ))}
          </div>
        )}
      </section>

      {error && <p role="alert" className="font-semibold text-[#a12a21]">{error}</p>}
      <button type="submit" disabled={busy} className="flex min-h-13 w-full items-center justify-center rounded-[10px] bg-signal text-base font-bold text-on-signal hover:bg-signal-dark disabled:opacity-50">{busy ? t("quote_creating") : t("quote_create")}</button>
      <p className="text-center text-[12.5px] text-muted">{t("quote_prices_note")}</p>
    </form>
  );
}
