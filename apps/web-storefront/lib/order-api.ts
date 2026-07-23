// Real, thin re-export -- placeOrder itself lives in lib/api.ts
// alongside every other real backend call this app makes, kept
// re-exported at this path too since the checkout page was already
// written against this path, and splitting order-placement into its
// own module name reads clearly for what it does.
//
// Renamed from placeGuestOrder to placeOrder (see lib/api.ts's own
// comment on that function for the real bug this closes: checkout
// previously always placed a guest order, even for a real logged-in
// buyer).
export { placeOrder } from "./api";
export type { PlaceOrderAddress, PlaceOrderResult } from "./api";
