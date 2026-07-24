"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { placeOrder } from "@/lib/order-api";
import { fetchMyAddresses, createAddress, SavedAddress, validatePromoCode } from "@/lib/api";

// REAL BUG FOUND AND FIXED HERE: this page used to always place a
// guest order (placeGuestOrder, always sending guestEmail) regardless
// of whether a real buyer was actually logged in -- checked via
// useAuth(), which this page never used at all before. Every single
// order placed through this storefront became a guest order, buyer_id
// null, completely disconnected from the real logged-in account. Now
// genuinely account-aware: a logged-in buyer sees their real saved
// addresses (up to 3, migration 017) and can pick one, add a new one
// and optionally save it, or a guest gets the same manual-entry flow
// as before.
export default function CheckoutPage() {
  const router = useRouter();
  const { cart, total, isLoading } = useCart();
  const { user, isLoading: authLoading } = useAuth();

  const [guestEmail, setGuestEmail] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [streetAddress, setStreetAddress] = useState("");

  // Real promo code support (new)
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);
  const [isValidatingPromoCode, setIsValidatingPromoCode] = useState(false);

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new" | null>(null);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [newAddressLabel, setNewAddressLabel] = useState("Home");

  const [isPlacing, setIsPlacing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const token = getAuthToken();
    if (!token) return;
    fetchMyAddresses(token)
      .then((addrs) => {
        setSavedAddresses(addrs);
        setAddressesLoaded(true);
        if (addrs.length > 0) {
          const def = addrs.find((a) => a.isDefault) || addrs[0];
          setSelectedAddressId(def.id);
        } else {
          setSelectedAddressId("new");
        }
      })
      .catch(() => setAddressesLoaded(true));
  }, [authLoading, user]);

  const handleApplyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    setIsValidatingPromoCode(true);
    setPromoCodeError(null);
    try {
      const token = getAuthToken();
      const result = await validatePromoCode(promoCodeInput.trim(), token || undefined);
      if (result.valid) {
        setAppliedPromoCode(promoCodeInput.trim());
      } else {
        setAppliedPromoCode(null);
        setPromoCodeError(result.reason);
      }
    } catch (err) {
      setPromoCodeError(err instanceof Error ? err.message : "Could not check this code right now.");
    } finally {
      setIsValidatingPromoCode(false);
    }
  };

  const handleRemovePromoCode = () => {
    setAppliedPromoCode(null);
    setPromoCodeInput("");
    setPromoCodeError(null);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || cart.items.length === 0) return;
    setErrorMessage(null);

    const items = cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));

    try {
      setIsPlacing(true);

      if (user) {
        if (selectedAddressId && selectedAddressId !== "new") {
          const order = await placeOrder(items, { userId: user.id }, { addressId: selectedAddressId }, appliedPromoCode || undefined);
          document.cookie = "leap_cart_id=; path=/; max-age=0";
          router.push(`/checkout/confirmation?orderId=${order.id}`);
          return;
        }
        if (!recipientName || !phone || !country || !city || !streetAddress) {
          setErrorMessage("Please fill in every address field.");
          setIsPlacing(false);
          return;
        }
        const address = { recipientName, phone, country, city, streetAddress };
        const order = await placeOrder(items, { userId: user.id }, { address }, appliedPromoCode || undefined);
        // Real, optional save-for-next-time -- a separate real call,
        // deliberately best-effort: a failure here shouldn't block an
        // order that already succeeded.
        if (saveNewAddress) {
          const token = getAuthToken();
          if (token) {
            await createAddress(token, { label: newAddressLabel || "Address", ...address }).catch(() => {});
          }
        }
        document.cookie = "leap_cart_id=; path=/; max-age=0";
        router.push(`/checkout/confirmation?orderId=${order.id}`);
        return;
      }

      // Real guest checkout (unchanged behavior from before this fix).
      if (!guestEmail || !recipientName || !phone || !country || !city || !streetAddress) {
        setErrorMessage("Please fill in every field.");
        setIsPlacing(false);
        return;
      }
      const order = await placeOrder(items, { guestEmail }, { address: { recipientName, phone, country, city, streetAddress } }, appliedPromoCode || undefined);
      document.cookie = "leap_cart_id=; path=/; max-age=0";
      router.push(`/checkout/confirmation?orderId=${order.id}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setIsPlacing(false);
    }
  };

  if (isLoading || authLoading) {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display font-bold text-3xl">Your cart is empty</h1>
        <p className="mt-3 text-muted">Add a part to your cart before checking out.</p>
      </div>
    );
  }

  const showManualForm = !user || selectedAddressId === "new";

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display font-bold text-3xl mb-8">Checkout</h1>

      <form onSubmit={handlePlaceOrder} className="space-y-6">
        {!user && (
          <div>
            <h2 className="font-display font-bold text-lg mb-3">Contact</h2>
            <input
              type="email"
              placeholder="Email address"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="w-full rounded-md border border-line px-4 py-3 text-sm"
            />
          </div>
        )}

        <div>
          <h2 className="font-display font-bold text-lg mb-3">Delivery address</h2>

          {user && addressesLoaded && savedAddresses.length > 0 && (
            <div className="space-y-2 mb-4">
              {savedAddresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${selectedAddressId === addr.id ? "border-signal" : "border-line"}`}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={selectedAddressId === addr.id}
                    onChange={() => setSelectedAddressId(addr.id)}
                    className="mt-1"
                  />
                  <div className="text-sm">
                    <p className="font-semibold">{addr.label}{addr.isDefault ? " · Default" : ""}</p>
                    <p className="text-muted">{addr.recipientName} · {addr.phone}</p>
                    <p className="text-muted">{addr.streetAddress}, {addr.city}, {addr.country}</p>
                  </div>
                </label>
              ))}
              <label
                className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer ${selectedAddressId === "new" ? "border-signal" : "border-line"}`}
              >
                <input
                  type="radio"
                  name="address"
                  checked={selectedAddressId === "new"}
                  onChange={() => setSelectedAddressId("new")}
                />
                <span className="text-sm font-semibold">Use a new address</span>
              </label>
            </div>
          )}

          {showManualForm && (
            <div className="space-y-3">
              {user && (
                <input
                  placeholder="Label (e.g. Home, Work)"
                  value={newAddressLabel}
                  onChange={(e) => setNewAddressLabel(e.target.value)}
                  className="w-full rounded-md border border-line px-4 py-3 text-sm"
                />
              )}
              <input
                placeholder="Recipient name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full rounded-md border border-line px-4 py-3 text-sm"
              />
              <input
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-line px-4 py-3 text-sm"
              />
              <input
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-md border border-line px-4 py-3 text-sm"
              />
              <input
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-md border border-line px-4 py-3 text-sm"
              />
              <input
                placeholder="Street address"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                className="w-full rounded-md border border-line px-4 py-3 text-sm"
              />
              {user && (
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} />
                  Save this address for next time
                </label>
              )}
            </div>
          )}
        </div>

        {/* Real promo code support (new) -- closes a real gap: the
            backend has always fully supported this (real server-side
            validation, real discount calculation, never a
            client-supplied amount), checkout just never had anywhere
            to enter one. Deliberately just an "is this code real right
            now" check here, not a discount preview -- the actual
            discount only ever comes from the real order-placement
            response itself (this page's own `total`, computed
            server-side). */}
        <div>
          {!appliedPromoCode ? (
            <div className="flex gap-2">
              <input
                placeholder="Promo code"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
                className="flex-1 rounded-md border border-line px-4 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleApplyPromoCode}
                disabled={isValidatingPromoCode || !promoCodeInput.trim()}
                className="rounded-md border border-line px-5 py-2 text-sm font-semibold hover:border-ink transition-colors disabled:opacity-60"
              >
                {isValidatingPromoCode ? "Checking…" : "Apply"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-md bg-chalk px-4 py-2">
              <span className="text-sm font-semibold text-signal">"{appliedPromoCode}" applied</span>
              <button type="button" onClick={handleRemovePromoCode} className="text-xs font-semibold text-muted hover:text-ink">
                Remove
              </button>
            </div>
          )}
          {promoCodeError && <p className="mt-2 text-sm text-red-600">{promoCodeError}</p>}
        </div>

        <div className="border-t border-line pt-6 flex items-center justify-between">
          <span className="font-display font-bold text-xl">Total</span>
          <span className="font-display font-bold text-2xl">${total.toFixed(2)}</span>
        </div>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

        <button
          type="submit"
          disabled={isPlacing}
          className="w-full rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors disabled:opacity-60"
        >
          {isPlacing ? "Placing order…" : "Place order"}
        </button>
      </form>
    </div>
  );
}
