import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_ADDRESS, type AddressFields } from "@/lib/address";

// "Use my location": each piece of the address in its own field (street with the district, city, region, postal code, country), lightly green until the buyer edits it.
const m = vi.hoisted(() => ({ reverse: vi.fn() }));
vi.mock("@/lib/nominatim", () => ({ currentPosition: async () => ({ latitude: 24.7, longitude: 46.6 }), reverseGeocode: (...a: unknown[]) => m.reverse(...a) }));
import AddressForm from "./AddressFields";
import { LangProvider } from "./LangProvider";

function Form({ lang = "en" }: { lang?: "en" | "ar" }) {
  const [v, setV] = useState<AddressFields>(EMPTY_ADDRESS);
  return <LangProvider lang={lang}><AddressForm value={v} onChange={setV} idPrefix="t" /></LangProvider>;
}

describe("filling the address from the buyer's location", () => {
  it("CRITICAL: the street, city, region, postal code and country each go to their own field, found by the country code, and are marked as filled", async () => {
    m.reverse.mockResolvedValue({ streetAddress: "Al Imam Saud Road, Al Masif", city: "Riyadh", state: "Riyadh Region", postalCode: "12467", country: "السعودية", countryCode: "SA" });
    render(<Form />);
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByDisplayValue("Al Imam Saud Road, Al Masif")).toHaveAttribute("data-filled", "true");
    expect(screen.getByDisplayValue("Riyadh Region")).toHaveAttribute("data-filled", "true");
    expect(screen.getByDisplayValue("12467")).toBeInTheDocument();
    expect((document.getElementById("t-country") as HTMLSelectElement).value).toBe("Saudi Arabia");
    expect(m.reverse).toHaveBeenCalledWith(24.7, 46.6, fetch, "en");
  });
  it("a field the buyer edits is no longer marked; the Arabic page asks in Arabic", async () => {
    m.reverse.mockResolvedValue({ streetAddress: "طريق الملك فهد، العليا", city: "الرياض", state: "", postalCode: "", country: "", countryCode: "SA" });
    render(<Form lang="ar" />);
    fireEvent.click(screen.getByRole("button", { name: /موقعي/ }));
    const street = await screen.findByDisplayValue("طريق الملك فهد، العليا");
    fireEvent.change(street, { target: { value: "طريق الملك فهد، العليا، مبنى 5" } });
    expect(street).not.toHaveAttribute("data-filled");
    expect(m.reverse).toHaveBeenLastCalledWith(24.7, 46.6, fetch, "ar");
  });
});
