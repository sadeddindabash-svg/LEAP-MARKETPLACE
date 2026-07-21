// Real, thin re-export -- placeGuestOrder itself lives in lib/api.ts
// alongside every other real backend call this app makes, kept
// re-exported at this path too since the checkout page was already
// written against it, and splitting order-placement into its own
// module name reads clearly for what it does.
export { placeGuestOrder } from "./api";
export type { PlaceOrderAddress, PlaceOrderResult } from "./api";
