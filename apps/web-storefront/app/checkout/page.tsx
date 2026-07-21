"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { placeGuestOrder } from "@/lib/order-api";

// Real Client Component -- a checkout form is inherently interactive
// and, like the cart, never needs search-engine visibility.
export default function CheckoutPage() {
  const router = useRouter();
  const { cart, total, isLoading } = useCart();
  const [guestEmail, setGuestEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || cart.items.length === 0) return;
    if (!guestEmail || !recipientName || !phone || !country || !city || !streetAddress) {
      setErrorMessage("Please fill in every field.");
      return;
    }
    setIsPlacing(true);
    setErrorMessage(null);
    try {
      const order = await placeGuestOrder(
        cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        guestEmail,
        { recipientName, phone, country, city, streetAddress }
      );
      // Real order placed -- the real cart's job is done, so it's
      // cleared here (a fresh real cart ID is generated next time
      // something is added, rather than reusing this now-irrelevant
      // one).
      document.cookie = "leap_cart_id=; path=/; max-age=0";
      router.push(`/checkout/confirmation?orderId=${order.id}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setIsPlacing(false);
    }
  };

  if (isLoading) {
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

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display font-bold text-3xl mb-8">Checkout</h1>

      <form onSubmit={handlePlaceOrder} className="space-y-6">
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

        <div>
          <h2 className="font-display font-bold text-lg mb-3">Delivery address</h2>
          <div className="space-y-3">
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
          </div>
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
