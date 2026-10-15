"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "@/components/LocLink";
import AddressForm from "@/components/AddressFields";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useLang, useT } from "@/components/LangProvider";
import { Price } from "@/components/Price";
import { useLocRouter } from "@/components/useLocRouter";
import {
  createAddress, fetchMyAddresses, fetchPaymentMethodsForCountry, placeOrder, resolveImageUrl, type PaymentMethod, type SavedAddress,
} from "@/lib/api";
import { EMAIL_PATTERN, EMPTY_ADDRESS, addressPayload, addressProblem, type AddressFields } from "@/lib/address";
import { hasMultipleSuppliers, loyaltyBeatsPromo, newIdempotencyKey, overStockItems } from "@/lib/cart";
import { countryName } from "@/lib/countries";
import type { DictKey } from "@/lib/i18n";

const card = "rounded-[14px] border border-line bg-white p-6";
const input = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";
const PROBLEM_TEXT: Record<string, DictKey> = { fill_every_field: "fill_every_field", country_not_served: "country_not_served", national_address_format: "national_address_format_error" };

// The checkout, in the order the mobile app has it: who is ordering, where it goes, how it will be paid (the payment methods available for that country, as a choice: no payment
// is collected online yet, in the app or here), "wait and ship together" when the cart has several suppliers, the summary with the discount the server applied, then place the order.
// The same order can never be placed twice (a double click or a retry sends the same key, and the server answers with the first order).
export default function CheckoutPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { cart, isLoading, summary, lockPrices, applyPromo, clearAfterOrder } = useCart();
  const lang = useLang();
  const t = useT();
  const { format } = useCurrency();
  const router = useLocRouter();

  const [guestEmail, setGuestEmail] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("new");                        // a saved address id, or "new"
  const [fields, setFields] = useState<AddressFields>(EMPTY_ADDRESS);
  const [saveNew, setSaveNew] = useState(true);
  const [chosenPayment, setChosenPayment] = useState<string | null>(null);
  const [methodsFor, setMethodsFor] = useState<{ country: string; methods: PaymentMethod[] } | null>(null);
  const [waitAll, setWaitAll] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const lockedOnce = useRef(false);

  // like the app: the prices are held the moment the checkout opens
  useEffect(() => {
    if (lockedOnce.current || !cart || cart.items.length === 0) return;
    lockedOnce.current = true;
    lockPrices();
  }, [cart, lockPrices]);

  // a signed-in buyer's saved addresses (the default one is picked)
  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchMyAddresses(token).then((list) => {
      if (!current) return;
      setSavedAddresses(list);
      const pick = list.find((a) => a.isDefault) ?? list[0];
      if (pick) setSelectedId(pick.id);
    }).catch(() => { if (current) setSavedAddresses([]); });
    return () => { current = false; };
  }, [user]);

  const savedPick = user && selectedId !== "new" ? savedAddresses?.find((a) => a.id === selectedId) : undefined;
  const country = savedPick ? savedPick.country : fields.country;

  // the payment methods for the country being delivered to
  useEffect(() => {
    if (!country) return;
    let current = true;
    fetchPaymentMethodsForCountry(country).then((methods) => { if (current) setMethodsFor({ country, methods }); }).catch(() => { if (current) setMethodsFor({ country, methods: [] }); });
    return () => { current = false; };
  }, [country]);
  const methods = country && methodsFor?.country === country ? methodsFor.methods : null;      // null = still loading (or no country yet)
  const payment = chosenPayment && methods?.some((m) => m.id === chosenPayment) ? chosenPayment : methods?.[0]?.id ?? null;

  if (isLoading || authLoading) return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8 text-muted" aria-busy="true">{t("search_loading")}</div>;
  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("checkout")}</h1>
        <p className="mb-6 mt-3 text-lg text-muted">{t("cart_empty")}</p>
        <Link href="/search" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("browse_products")}</Link>
      </div>
    );
  }

  const overStock = overStockItems(cart);
  const several = hasMultipleSuppliers(cart);
  const showForm = !user || selectedId === "new" || savedAddresses?.length === 0;

  const applyCode = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setCheckingPromo(true); setPromoError(null);
    try { await applyPromo(code); setPromoInput(""); } catch (e) { setPromoError(e instanceof Error ? e.message : t("generic_error")); } finally { setCheckingPromo(false); }
  };

  const place = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      if (!guestEmail.trim()) return setError(t("please_enter_email_order"));
      if (!EMAIL_PATTERN.test(guestEmail.trim())) return setError(t("please_enter_valid_email"));
    }
    if (user && !showForm && !savedPick) return setError(t("please_select_address"));
    if (showForm) {
      const problem = addressProblem(fields, { needLabel: false });
      if (problem) return setError(t(PROBLEM_TEXT[problem]));
    }
    if (overStock.length > 0) return;

    const items = cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    const payload = showForm ? addressPayload(fields) : null;
    const address = payload && { recipientName: payload.recipientName, phone: payload.phone, country: payload.country, city: payload.city, streetAddress: payload.streetAddress };
    keyRef.current ??= newIdempotencyKey();
    setPlacing(true);
    try {
      const order = await placeOrder(
        items,
        user ? { userId: user.id } : { guestEmail: guestEmail.trim() },
        savedPick ? { addressId: savedPick.id } : { address: address! },
        cart.appliedPromoCode ?? undefined,
        { waitForAllShipments: waitAll && several, idempotencyKey: keyRef.current, lang },
      );
      // a new address typed by a signed-in buyer is kept for next time (best effort: the order is already placed)
      const token = getAuthToken();
      if (user && showForm && saveNew && token && payload) await createAddress(token, { ...payload, label: payload.label || t("address_fallback_label") }).catch(() => {});
      clearAfterOrder();
      router.push(`/checkout/confirmation?orderId=${encodeURIComponent(order.id)}${user ? "" : `&guestEmail=${encodeURIComponent(guestEmail.trim())}`}`);
    } catch (err) {
      if (!(err instanceof TypeError)) keyRef.current = null;                    // the server answered (a refusal): a new attempt is a new order. No answer at all: the retry keeps its key.
      setError(err instanceof Error && err.message ? err.message : t("order_placement_error"));
      setPlacing(false);
    }
  };

  return (
    <form onSubmit={place} noValidate className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-navy">{t("checkout")}</h1>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid gap-6">
          <section className={card} aria-labelledby={user ? "co-contact" : undefined}>
            {user ? (
              <><h2 id="co-contact" className="mb-1 text-xl font-bold">{t("ordering_as")}</h2><p className="text-muted">{user.email}</p></>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted">{t("guest_checkout_note")}</p>
                <label htmlFor="co-email" className="mb-1.5 block text-[13px] font-bold text-navy">{t("email_for_confirmation")}</label>
                <input id="co-email" type="email" inputMode="email" autoComplete="email" dir="ltr" className={input} value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
                <p className="mt-3"><Link href="/login" className="text-sm font-semibold text-navy underline underline-offset-4">{t("have_account_login_instead")}</Link></p>
              </>
            )}
          </section>

          <section className={card} aria-labelledby="co-address">
            <h2 id="co-address" className="mb-4 text-xl font-bold">{t("delivery_address")}</h2>
            {user && savedAddresses && savedAddresses.length > 0 && (
              <div className="mb-4 grid gap-2.5" role="radiogroup" aria-label={t("delivery_address")}>
                {savedAddresses.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3.5 ${selectedId === a.id ? "border-navy bg-[#f4f8fb]" : "border-line"}`}>
                    <input type="radio" name="address" className="mt-1 size-5 accent-[#0b3146]" checked={selectedId === a.id} onChange={() => setSelectedId(a.id)} />
                    <span><strong className="block">{a.label} · {a.recipientName}</strong><span className="text-sm text-muted">{a.streetAddress}, {a.city}, {countryName(lang, a.country)}</span></span>
                  </label>
                ))}
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] p-3.5 ${selectedId === "new" ? "border-navy bg-[#f4f8fb]" : "border-line"}`}>
                  <input type="radio" name="address" className="size-5 accent-[#0b3146]" checked={selectedId === "new"} onChange={() => setSelectedId("new")} />
                  <span className="font-semibold">{t("use_new_address")}</span>
                </label>
              </div>
            )}
            {user && savedAddresses && savedAddresses.length === 0 && <p className="mb-3 text-sm text-muted">{t("no_saved_addresses")}</p>}
            {showForm && (
              <>
                <AddressForm idPrefix="co" value={fields} onChange={setFields} disabled={placing} />
                {user && (
                  <label className="mt-4 flex items-center gap-2.5 text-sm text-muted">
                    <input type="checkbox" className="size-5 accent-[#0b3146]" checked={saveNew} onChange={(e) => setSaveNew(e.target.checked)} />
                    {t("save_address_for_next_time")}
                  </label>
                )}
              </>
            )}
          </section>

          <section className={card} aria-labelledby="co-pay">
            <h2 id="co-pay" className="mb-3 text-xl font-bold">{t("payment_method")}</h2>
            {!country ? null : methods === null ? (
              <p className="text-muted" aria-busy="true">{t("search_loading")}</p>
            ) : methods.length === 0 ? (
              <p className="text-sm text-muted">{t("no_payment_methods_for_country")}</p>
            ) : (
              <div className="grid gap-2.5" role="radiogroup" aria-label={t("payment_method")}>
                {methods.map((m) => (
                  <label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] p-3.5 ${payment === m.id ? "border-navy bg-[#f4f8fb]" : "border-line"}`}>
                    <input type="radio" name="payment" className="size-5 accent-[#0b3146]" checked={payment === m.id} onChange={() => setChosenPayment(m.id)} />
                    {m.photoUrl && <Image src={resolveImageUrl(m.photoUrl)} alt="" width={28} height={28} className="rounded object-contain" unoptimized />}
                    <span className="font-semibold">{lang === "ar" && m.nameAr ? m.nameAr : m.nameEn}</span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {several && (
            <label className={`${card} flex cursor-pointer items-start gap-3`}>
              <input type="checkbox" role="switch" className="mt-1 size-5 accent-[#0b3146]" checked={waitAll} onChange={(e) => setWaitAll(e.target.checked)} />
              <span><strong className="block">{t("wait_for_all_shipments_title")}</strong><span className="text-sm text-muted">{t("wait_for_all_shipments_subtitle")}</span></span>
            </label>
          )}
        </div>

        <aside className={card} aria-labelledby="co-summary">
          <h2 id="co-summary" className="mb-4 text-xl font-bold">{t("order_summary")}</h2>
          <ul className="mb-3 grid gap-2 text-sm">
            {cart.items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3"><span className="min-w-0 truncate">{i.name} × {i.quantity}</span><Price usd={i.price * i.quantity} className="font-semibold" /></li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-line py-2"><span>{t("subtotal")}</span><Price usd={summary.subtotal} /></div>
          {summary.discount > 0 && (
            <div className="flex justify-between py-2 font-semibold text-[#0f6b49]">
              <span>{summary.source === "loyalty" ? t("loyalty_discount_line", { n: Math.round(summary.loyaltyPercent) }) : `${t("discount")}${summary.promoCode ? ` (${summary.promoCode})` : ""}`}</span>
              <span>−<Price usd={summary.discount} /></span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t-2 border-line pt-3 text-[22px] font-extrabold"><span>{t("total")}</span><Price usd={summary.total} /></div>
          {loyaltyBeatsPromo(cart) && <p className="mt-2 text-sm text-muted">{t("loyalty_beats_promo", { amount: format(summary.discount) })}</p>}
          {cart.lockActive && <p className="mt-2 text-xs text-muted">{t("price_locked_note")}</p>}

          <div className="mt-4 border-t border-line pt-4">
            {cart.appliedPromoCode ? (
              <p className="flex items-center justify-between gap-3 text-sm font-semibold text-[#0f6b49]">
                <span>{cart.appliedPromoCode} · {t("promo_applied")}</span>
                <button type="button" className="text-sm font-bold text-navy underline underline-offset-4" onClick={() => { setPromoError(null); applyPromo(null).catch(() => {}); }}>{t("remove")}</button>
              </p>
            ) : (
              <div className="flex gap-2">
                <label htmlFor="co-promo" className="sr-only">{t("promo_code_field")}</label>
                <input id="co-promo" className={input} placeholder={t("promo_code_field")} value={promoInput} dir="ltr" onChange={(e) => setPromoInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCode(); } }} />
                <button type="button" onClick={applyCode} disabled={checkingPromo || !promoInput.trim()} className="min-h-12 flex-none rounded-[10px] bg-navy px-5 font-bold text-white disabled:opacity-50">{checkingPromo ? t("checking") : t("apply")}</button>
              </div>
            )}
            {promoError && <p role="alert" className="mt-2 text-sm font-semibold text-[#a12a21]">{promoError}</p>}
          </div>

          {overStock.length > 0 && (
            <p role="alert" className="mt-4 text-sm font-semibold text-[#a12a21]">{t(overStock.length === 1 ? "stock_changed_one" : "stock_changed_many", { items: overStock.map((i) => i.name).join(", ") })}</p>
          )}
          {error && <p role="alert" className="mt-4 text-sm font-semibold text-[#a12a21]">{error}</p>}
          <button type="submit" disabled={placing || overStock.length > 0} className="mt-5 min-h-13 w-full rounded-[10px] bg-signal text-base font-bold text-on-signal hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-50">
            {placing ? t("placing_order") : t("place_order")}
          </button>
        </aside>
      </div>
    </form>
  );
}
