import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SellerSignals from "./SellerSignals";

// Under the stock box: the Verified seller icon is a FILLED gold badge with a white check, and "Ships from ..." has the flag of the country (the globe for a country without one).
const show = (over: Partial<React.ComponentProps<typeof SellerSignals>> = {}, lang: "en" | "ar" = "en") => render(<SellerSignals isVerifiedSeller shipsFromCountry="China" shipsFromCountryAr="الصين" lang={lang} {...over} />);
describe("the verified seller icon", () => {
  it("is filled (solid gold badge) with a white check on top, a little larger than before, and hidden from screen readers", () => { show(); const svg = screen.getByTestId("verified-icon"); expect(svg.getAttribute("fill")).toBe("#e39f0c"); expect(svg.getAttribute("aria-hidden")).toBe("true"); const paths = svg.querySelectorAll("path"); expect(paths).toHaveLength(2); expect(paths[0].getAttribute("d")!.startsWith("M12 2l2.4")).toBe(true); expect(paths[1].getAttribute("stroke")).toBe("#fff"); expect(paths[1].getAttribute("fill")).toBe("none"); expect(svg.getAttribute("width")).toBe("17"); });
  it("the words stay: Verified seller; not shown when the seller is not verified", () => { show(); expect(screen.getByText("Verified seller")).toBeInTheDocument(); expect(screen.queryByTestId("verified-icon")).toBeInTheDocument(); });
  it("no icon and no words for a seller that is not verified", () => { show({ isVerifiedSeller: false }); expect(screen.queryByTestId("verified-icon")).not.toBeInTheDocument(); expect(screen.queryByText("Verified seller")).not.toBeInTheDocument(); });
});
describe("the country flag beside Ships from", () => {
  it("China shows its flag instead of the globe, with the words as before", () => { const { container } = show(); expect(screen.getByTestId("country-flag").getAttribute("data-flag")).toBe("CN"); expect(container.textContent).toContain("Ships from China Warehouse"); expect(container.querySelectorAll("svg circle[r=\"10\"]")).toHaveLength(0); });
  it("the flag comes before the words (on the start side: it mirrors in Arabic)", () => { show(); const li = screen.getByTestId("country-flag").closest("li")!; expect(li.firstElementChild).toBe(screen.getByTestId("country-flag")); });
  it("a country without a flag keeps the globe", () => { const { container } = show({ shipsFromCountry: "Brazil", shipsFromCountryAr: "البرازيل" }); expect(screen.queryByTestId("country-flag")).not.toBeInTheDocument(); expect(container.querySelector("svg circle[r=\"10\"]")).not.toBeNull(); expect(container.textContent).toContain("Brazil"); });
  it("the flag is found from the Arabic name too, and the Arabic page shows the Arabic words", () => { show({ shipsFromCountry: "Cina", shipsFromCountryAr: "الصين" }, "ar"); expect(screen.getByTestId("country-flag").getAttribute("data-flag")).toBe("CN"); });
  it("a seller with no country has no Ships from line and no flag", () => { show({ shipsFromCountry: null, shipsFromCountryAr: null }); expect(screen.queryByTestId("country-flag")).not.toBeInTheDocument(); expect(screen.queryByText(/Ships from/)).not.toBeInTheDocument(); });
  it("nothing at all when there is neither", () => { const { container } = show({ isVerifiedSeller: false, shipsFromCountry: null }); expect(container.firstChild).toBeNull(); });
});
