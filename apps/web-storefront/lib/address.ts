// A delivery address, with the rules of the mobile app's address form (apps/mobile/lib/features/account/address_form_screen.dart).
import { findCountry } from "./countries";

export interface AddressFields {
  label: string;
  recipientName: string;
  phone: string;
  country: string;                 // the English name of one of our countries
  state: string;
  city: string;
  streetAddress: string;
  postalCode: string;
  nationalAddress: string;         // Saudi Arabia only
}

export const EMPTY_ADDRESS: AddressFields = { label: "", recipientName: "", phone: "", country: "", state: "", city: "", streetAddress: "", postalCode: "", nationalAddress: "" };
export const MAX_ADDRESSES = 3;                                                         // the server refuses a fourth

/** Saudi Arabia's short address: four letters then four numbers (RRRD2929). */
export const SAUDI_NATIONAL_ADDRESS = /^[A-Za-z]{4}[0-9]{4}$/;
export const isSaudi = (country: string): boolean => findCountry(country)?.en === "Saudi Arabia";
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AddressProblem = "fill_every_field" | "country_not_served" | "national_address_format";

/**
 * What is wrong with an address, or null when it can be used. `needLabel` is true for a SAVED address (it has a name like "Home"); an address typed for one order has none.
 * The national address code is required only for Saudi Arabia, like the app.
 */
export function addressProblem(a: AddressFields, opts: { needLabel: boolean }): AddressProblem | null {
  const required = [a.recipientName, a.phone, a.country, a.city, a.streetAddress, ...(opts.needLabel ? [a.label] : [])];
  if (required.some((v) => !v.trim())) return "fill_every_field";
  if (!findCountry(a.country)) return "country_not_served";
  if (isSaudi(a.country) && !SAUDI_NATIONAL_ADDRESS.test(a.nationalAddress.trim())) return "national_address_format";
  return null;
}

/** The body the server takes for a saved address: the English country name, empty optional fields as null, the Saudi code in capitals (and only for Saudi Arabia). */
export function addressPayload(a: AddressFields, isDefault?: boolean) {
  const country = findCountry(a.country)?.en ?? a.country.trim();
  return {
    label: a.label.trim(),
    recipientName: a.recipientName.trim(),
    phone: a.phone.trim(),
    country,
    state: a.state.trim() || null,
    city: a.city.trim(),
    streetAddress: a.streetAddress.trim(),
    postalCode: a.postalCode.trim() || null,
    ...(isSaudi(country) ? { nationalAddress: a.nationalAddress.trim().toUpperCase() } : {}),
    ...(isDefault !== undefined ? { isDefault } : {}),
  };
}

/** A saved address as the form fields (for editing). */
export function fieldsOf(saved: { label: string; recipientName: string; phone: string; country: string; state?: string | null; city: string; streetAddress: string; postalCode: string | null; nationalAddress?: string | null }): AddressFields {
  return { label: saved.label, recipientName: saved.recipientName, phone: saved.phone, country: saved.country, state: saved.state ?? "", city: saved.city, streetAddress: saved.streetAddress, postalCode: saved.postalCode ?? "", nationalAddress: saved.nationalAddress ?? "" };
}
