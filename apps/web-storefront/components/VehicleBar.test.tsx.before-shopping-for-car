import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// The "Shopping for" container, like the mobile app's card: the label, the default car in a chip, the car's picture in an angled panel; "Add a vehicle" for everyone without a car; a same-size empty box while loading;
// the whole container opens My garage. The sign-in state and the garage are replaced by fixed values.
const m = vi.hoisted(() => ({ auth: { current: { user: { id: "u1" } as unknown, isLoading: false } }, garage: { current: { defaultVehicle: null as unknown, loading: false } } }));
vi.mock("./AuthProvider", () => ({ useAuth: () => m.auth.current }));
vi.mock("./GarageProvider", () => ({ useGarage: () => m.garage.current }));
vi.mock("@/lib/api", () => ({ resolveImageUrl: (u: string) => `https://api.example.com${u}` }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/image", () => ({ default: (p: { src: string; alt: string; onError?: () => void }) => <img data-testid="car-photo" src={p.src} alt={p.alt} onError={p.onError} /> }));
import VehicleBar from "./VehicleBar";
import { vehiclePhoto } from "@/lib/garage";
import { LangProvider } from "./LangProvider";

const car = (over: Record<string, unknown> = {}) => ({ generationId: "g1", year: 2024, brand: "BYD", brandAr: "بي واي دي", model: "Seal DM-i", modelAr: null, isDefault: true, brandPhotoUrl: null, generationPhotoUrl: null, version: null, ...over });
const show = (where: "menu" | "row" = "menu", lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><VehicleBar where={where} /></LangProvider>);
const card = () => screen.getByTestId("vehicle-card");
beforeEach(() => { m.auth.current = { user: { id: "u1" }, isLoading: false }; m.garage.current = { defaultVehicle: car(), loading: false }; });

describe("with a saved car", () => {
  it("shows the label, the car in a chip, and the whole container opens My garage (there is no separate Change link)", () => {
    show(); expect(card().getAttribute("href")).toBe("/garage"); expect(card().getAttribute("data-state")).toBe("car"); expect(screen.getByText("Shopping for")).toBeInTheDocument(); expect(screen.getByText("BYD Seal DM-i · 2024").className).toContain("bg-navy");
    expect(screen.queryByText("Change")).not.toBeInTheDocument(); expect(screen.getAllByRole("link")).toHaveLength(1);
  });
  it("the accessible name and the tooltip carry the full text", () => { show(); expect(screen.getByRole("link", { name: "Shopping for: BYD Seal DM-i · 2024" })).toBe(card()); expect(card().getAttribute("title")).toBe("BYD Seal DM-i · 2024"); });
  it("a car with a version shows it after the year (as the website always did)", () => { m.garage.current = { defaultVehicle: car({ model: "M5", brand: "AITO", year: 2022, version: { name: "AWD Flagship", nameAr: null } }), loading: false }; show(); expect(screen.getByText("AITO M5 · 2022 · AWD Flagship")).toBeInTheDocument(); });
  it("a name that is too long for the space stays on ONE line and is cut with … (never wraps, never widens the menu row); the full text is in the tooltip", () => {
    const long = "Mercedes-Benz GLC 300 · 2024 · AMG Line Premium Plus"; m.garage.current = { defaultVehicle: car({ brand: "Mercedes-Benz", model: "GLC 300", version: { name: "AMG Line Premium Plus", nameAr: null } }), loading: false }; show();
    const chip = screen.getByText(long); expect(chip.className).toContain("truncate"); expect(chip.className).toContain("max-w-full"); expect(card().getAttribute("title")).toBe(long); expect(card().className).toContain("h-10"); expect(card().className).toContain("overflow-hidden");
  });
  it("in Arabic: the Arabic label and brand, and the link keeps /ar", () => { show("menu", "ar"); expect(screen.getByText("التسوق لسيارة")).toBeInTheDocument(); expect(screen.getByText("بي واي دي Seal DM-i · 2024")).toBeInTheDocument(); expect(card().getAttribute("href")).toBe("/ar/garage"); });
});
describe("the car's picture", () => {
  it("is the version's photo first, then the year's photo, then the brand's photo", () => {
    const src = () => screen.getByTestId("car-photo").getAttribute("src");
    m.garage.current = { defaultVehicle: car({ brandPhotoUrl: "/b.png", generationPhotoUrl: "/g.png", version: { name: "V", nameAr: null, photoUrl: "/v.png" } }), loading: false }; const a = show(); expect(src()).toBe("https://api.example.com/v.png"); a.unmount();
    m.garage.current = { defaultVehicle: car({ brandPhotoUrl: "/b.png", generationPhotoUrl: "/g.png" }), loading: false }; const b = show(); expect(src()).toBe("https://api.example.com/g.png"); b.unmount();
    m.garage.current = { defaultVehicle: car({ brandPhotoUrl: "/b.png" }), loading: false }; show(); expect(src()).toBe("https://api.example.com/b.png");
  });
  it("with no photo at all a plain car icon stands in", () => { show(); expect(screen.queryByTestId("car-photo")).not.toBeInTheDocument(); expect(screen.getByTestId("vehicle-card-picture").querySelector("svg")).not.toBeNull(); });
  it("a photo that cannot be loaded is replaced by the icon (no broken picture)", () => {
    m.garage.current = { defaultVehicle: car({ brandPhotoUrl: "/b.png" }), loading: false }; show(); fireEvent.error(screen.getByTestId("car-photo")); expect(screen.queryByTestId("car-photo")).not.toBeInTheDocument(); expect(screen.getByTestId("vehicle-card-picture").querySelector("svg")).not.toBeNull();
  });
  it("a photo that cannot be loaded is skipped: the next one (year, then brand) is tried before the plain icon", () => {
    m.garage.current = { defaultVehicle: car({ generationPhotoUrl: "/g.png", brandPhotoUrl: "/b.png" }), loading: false }; show();
    expect(screen.getByTestId("car-photo").getAttribute("src")).toBe("https://api.example.com/g.png"); fireEvent.error(screen.getByTestId("car-photo"));
    expect(screen.getByTestId("car-photo").getAttribute("src")).toBe("https://api.example.com/b.png"); fireEvent.error(screen.getByTestId("car-photo"));
    expect(screen.queryByTestId("car-photo")).not.toBeInTheDocument(); expect(screen.getByTestId("vehicle-card-picture").querySelector("svg")).not.toBeNull();
  });
  it("the first picture it tries is always the one the garage code names for that car (version, then year, then brand)", () => {
    for (const over of [{ brandPhotoUrl: "/b.png" }, { generationPhotoUrl: "/g.png", brandPhotoUrl: "/b.png" }, { generationPhotoUrl: "/g.png", brandPhotoUrl: "/b.png", version: { name: "V", nameAr: null, photoUrl: "/v.png" } }]) {
      const c = car(over); m.garage.current = { defaultVehicle: c, loading: false }; const view = show(); expect(screen.getByTestId("car-photo").getAttribute("src")).toBe(`https://api.example.com${vehiclePhoto(c as never)}`); view.unmount();
    }
  });
  it("the picture panel is angled, mirrored in Arabic, and is decoration (empty alt)", () => {
    m.garage.current = { defaultVehicle: car({ brandPhotoUrl: "/b.png" }), loading: false }; show(); const c = screen.getByTestId("vehicle-card-picture").className; expect(c).toContain("[clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)]"); expect(c).toContain("rtl:[clip-path:polygon(0_0,78%_0,100%_100%,0_100%)]"); expect(screen.getByTestId("car-photo").getAttribute("alt")).toBe("");
  });
});
describe("with no car, or signed out (as in the app)", () => {
  it("says \"Add a vehicle\" and opens My garage: for a signed-in buyer with no car, and for a visitor who is not signed in", () => {
    m.garage.current = { defaultVehicle: null, loading: false }; const a = show(); expect(card().getAttribute("data-state")).toBe("empty"); expect(screen.getByText("Add a vehicle")).toBeInTheDocument(); expect(screen.getByRole("link", { name: "Shopping for: Add a vehicle" }).getAttribute("href")).toBe("/garage"); a.unmount();
    m.auth.current = { user: null, isLoading: false }; show(); expect(screen.getByText("Add a vehicle")).toBeInTheDocument(); expect(card().getAttribute("href")).toBe("/garage");
  });
  it("a signed-out visitor never sees a car, even if the garage held one a moment ago", () => { m.auth.current = { user: null, isLoading: false }; show(); expect(screen.queryByText(/Seal/)).not.toBeInTheDocument(); });
  it("in Arabic: أضف مركبة, the arrow turns round, and the link keeps /ar", () => { m.garage.current = { defaultVehicle: null, loading: false }; show("menu", "ar"); expect(screen.getByText("أضف مركبة")).toBeInTheDocument(); expect(card().getAttribute("href")).toBe("/ar/garage"); expect(card().querySelector("svg.rtl\\:rotate-180")).not.toBeNull(); });
});
describe("while the sign-in or the garage is still being read", () => {
  it("is an empty box of the same height: no words, no link (so a signed-in buyer never sees \"Add a vehicle\" for a moment)", () => {
    m.auth.current = { user: null, isLoading: true }; const a = show(); const box = screen.getByTestId("vehicle-card-loading"); expect(box.className).toContain("h-10"); expect(screen.queryByText("Add a vehicle")).not.toBeInTheDocument(); expect(screen.queryByRole("link")).not.toBeInTheDocument(); expect(box.getAttribute("aria-hidden")).toBe("true"); a.unmount();
    m.auth.current = { user: { id: "u1" }, isLoading: false }; m.garage.current = { defaultVehicle: null, loading: true }; show(); expect(screen.getByTestId("vehicle-card-loading")).toBeInTheDocument(); expect(screen.queryByText("Add a vehicle")).not.toBeInTheDocument();
  });
  it("a signed-out visitor is not kept waiting by the garage (it has nothing to load)", () => { m.auth.current = { user: null, isLoading: false }; m.garage.current = { defaultVehicle: null, loading: true }; show(); expect(screen.getByText("Add a vehicle")).toBeInTheDocument(); });
});
describe("the two places", () => {
  it("menu: at the end of the menu row on computer screens only (hidden below the large breakpoint), never narrower than 17rem and never wider than 34rem", () => {
    const { container } = show("menu"); const w = container.querySelector("[data-where]")!; expect(w.getAttribute("data-where")).toBe("menu"); for (const c of ["hidden", "lg:block", "ms-auto", "min-w-[17rem]", "max-w-[34rem]"]) expect(w.className.split(" "), c).toContain(c);
  });
  it("row: its own row under the menu, only below the large breakpoint, inside the page's usual width", () => {
    const { container } = show("row"); const w = container.querySelector("[data-where]")!; expect(w.getAttribute("data-where")).toBe("row"); expect(w.className.split(" ")).toContain("lg:hidden"); expect(w.className).toContain("border-b"); expect(w.firstElementChild!.className).toContain("max-w-7xl");
  });
  it("the container is 40 px high, inside the 48 px menu row, so the row does not grow", () => { show(); expect(card().className.split(" ")).toContain("h-10"); });
});
