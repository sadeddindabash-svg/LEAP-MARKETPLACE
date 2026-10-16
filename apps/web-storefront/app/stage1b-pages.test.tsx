import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ProductDetail } from "@/lib/api";

// The compare, find, garage and wishlist pages of this stage, with the server, the language and the sign-in state replaced by fixed values.
const m = vi.hoisted(() => ({
  lang: { current: "en" as "en" | "ar" },
  auth: { current: { user: null as { id: string } | null, isLoading: false } },
  garage: { current: { vehicles: [] as unknown[], defaultVehicle: null as unknown, signedIn: false, loading: false, add: vi.fn(), remove: vi.fn(), makeDefault: vi.fn() } },
  products: {} as Record<string, unknown>,
  fetchProductById: vi.fn(),
  wishlist: [] as unknown[],
  toolsProps: { current: null as unknown },
}));

vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => m.lang.current) }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => m.auth.current, getAuthToken: () => "tok" }));
vi.mock("@/components/GarageProvider", () => ({ useGarage: () => m.garage.current }));
vi.mock("@/components/VehicleCascade", () => ({
  default: ({ onChange }: { onChange: (c: { generationId: string; year: number; label: string } | null) => void }) => <button type="button" onClick={() => onChange({ generationId: "g9", year: 2020, label: "x" })}>pick a car</button>,
}));
vi.mock("@/components/FindTools", () => ({ default: (props: { categories: unknown[]; initialTab: string }) => { m.toolsProps.current = props; return <div data-testid="tools" data-tab={props.initialTab} data-count={props.categories.length} />; } }));
vi.mock("@/lib/api", () => ({
  fetchProductById: (...a: unknown[]) => m.fetchProductById(...a),
  fetchCategories: vi.fn(async () => [{ id: "brake", nameEn: "Brake System", nameAr: "نظام الفرامل", photoUrl: null, sortOrder: 1, commissionPercent: 10 }]),
  fetchWishlist: vi.fn(async () => m.wishlist),
  removeFromWishlist: vi.fn(async () => {}),
  resolveImageUrl: (u: string) => u,
}));

import { LangProvider } from "@/components/LangProvider";

const product = (id: string, over: Partial<ProductDetail> = {}): ProductDetail => ({
  id, name: `Part ${id}`, description: null, category: "brake", part: "Front Brake Disc", position: null, oemNumber: "34116792217", currencyCode: "USD", rating: 4.5, reviewCount: 3, stockQuantity: 12,
  estimatedDeliveryDays: 5, weightKg: 4.25, status: "active", price: 43, images: [], brand: null, model: null, year: null, fitsVehicleIds: [], isVerifiedSeller: true, shipsFromCountry: "China", shipsFromCountryAr: "الصين", ...over,
});
const wrap = (lang: "en" | "ar", node: React.ReactNode) => <LangProvider lang={lang}>{node}</LangProvider>;

beforeEach(() => {
  vi.clearAllMocks();
  m.lang.current = "en";
  m.auth.current = { user: null, isLoading: false };
  m.garage.current = { vehicles: [], defaultVehicle: null, signedIn: false, loading: false, add: vi.fn(), remove: vi.fn(), makeDefault: vi.fn() };
  m.fetchProductById.mockImplementation(async (id: string) => (id.startsWith("x") ? null : product(id, id === "p2" ? { rating: null, reviewCount: 0, stockQuantity: 0, estimatedDeliveryDays: null, weightKg: null, isVerifiedSeller: false, shipsFromCountry: null, oemNumber: null, price: 31 } : {})));
});

describe("compare page", () => {
  const open = async (ids: string | undefined, lang: "en" | "ar" = "en") => {
    m.lang.current = lang;
    const { default: ComparePage } = await import("./compare/page");
    return render(wrap(lang, await ComparePage({ searchParams: Promise.resolve({ ids }) })));
  };
  const row = (label: string) => screen.getByRole("rowheader", { name: label }).closest("tr") as HTMLElement;

  it("CRITICAL: shows each part side by side with the same rows as the mobile app's compare screen", async () => {
    await open("p1,p2");
    expect(screen.getByRole("heading", { name: "Compare parts" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Part p1", "Part p2"]);
    expect(within(row("Price")).getAllByRole("cell").map((c) => c.textContent)).toEqual(["$43", "$31"]);
    expect(within(row("Rating")).getAllByRole("cell").map((c) => c.textContent)).toEqual(["4.5 (3)", "No reviews yet"]);
    expect(within(row("Stock")).getAllByRole("cell").map((c) => c.textContent)).toEqual(["12 in stock", "Out of stock"]);
    expect(within(row("Delivery")).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Delivery in 5 days", "—"]);
    expect(within(row("OEM number")).getAllByRole("cell").map((c) => c.textContent)).toEqual(["34116792217", "—"]);
    expect(within(row("Weight")).getAllByRole("cell").map((c) => c.textContent)).toEqual(["4.3 kg", "—"]);
    expect(within(row("Verified seller")).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Yes", "—"]);
    expect(within(row("Ships from")).getAllByRole("cell").map((c) => c.textContent)).toEqual(["China", "—"]);
    expect(screen.getByRole("link", { name: "Part p1" }).getAttribute("href")).toBe("/products/p1");
  });

  it("CRITICAL: in Arabic the labels, the values and the country are Arabic, and links keep /ar", async () => {
    await open("p1,p2", "ar");
    expect(screen.getByRole("heading", { name: "مقارنة القطع" })).toBeInTheDocument();
    expect(within(row("السعر")).getAllByRole("cell")[0].textContent).toBe("$43");
    expect(within(row("المخزون")).getAllByRole("cell").map((c) => c.textContent)).toEqual(["12 متوفر", "غير متوفر"]);
    expect(within(row("الشحن من")).getAllByRole("cell")[0].textContent).toBe("الصين");
    expect(within(row("بائع موثّق")).getAllByRole("cell")[0].textContent).toBe("نعم");
    expect(screen.getByRole("link", { name: "Part p1" }).getAttribute("href")).toBe("/ar/products/p1");
  });

  it("CRITICAL: at most four parts are compared, each once, and a part that does not exist is dropped", async () => {
    await open("p1,p1,p2,p3,p4,p5");
    expect(m.fetchProductById.mock.calls.map((c) => c[0])).toEqual(["p1", "p2", "p3", "p4"]);
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
  });

  it("fewer than two parts is a plain message pointing back at the wishlist, never an empty table", async () => {
    await open("p1,x-gone");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/Pick at least 2 parts to compare\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wishlist" }).getAttribute("href")).toBe("/wishlist");
  });

  it("an address with no parts at all is the same plain message", async () => {
    await open(undefined);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/Pick at least 2 parts to compare\./)).toBeInTheDocument();
  });
});

describe("find page", () => {
  it("CRITICAL: is public and indexable, with its own title and language alternates, and opens the tab it is told to", async () => {
    const { default: FindPage, generateMetadata } = await import("./find/page");
    const meta = await generateMetadata();
    expect(meta.title).toBe("Find the right part");
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.languages).toMatchObject({ en: expect.stringMatching(/\/find$/), ar: expect.stringMatching(/\/ar\/find$/) });
    render(wrap("en", await FindPage({ searchParams: Promise.resolve({ tab: "vin" }) })));
    expect(screen.getByTestId("tools").dataset.tab).toBe("vin");
    expect(screen.getByTestId("tools").dataset.count).toBe("1");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Find the right part");
  });

  it("an unknown tab opens the first one, and the Arabic page is Arabic", async () => {
    m.lang.current = "ar";
    const { default: FindPage } = await import("./find/page");
    render(wrap("ar", await FindPage({ searchParams: Promise.resolve({ tab: "nonsense" }) })));
    expect(screen.getByTestId("tools").dataset.tab).toBe("vehicle");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("اعثر على القطعة المناسبة");
  });
});

describe("garage page", () => {
  const car = (over = {}) => ({ generationId: "g1", year: 2024, brand: "BYD", brandAr: "بي واي دي", model: "Seal DM-i", modelAr: null, generation: "2024", yearStart: 2024, yearEnd: 2024, isDefault: true, ...over });
  const open = async (lang: "en" | "ar" = "en") => { const { default: GaragePage } = await import("./garage/page"); return render(wrap(lang, <GaragePage />)); };

  it("waits while the sign-in state is being read, and signed out asks to sign in instead of showing a garage", async () => {
    m.auth.current = { user: null, isLoading: true };
    const { unmount } = await open();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    unmount();
    m.auth.current = { user: null, isLoading: false };
    await open();
    expect(screen.getByText("Sign in to save your cars.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByText("Add a car")).not.toBeInTheDocument();
  });

  it("CRITICAL: lists the saved cars, marks the default, and each action goes to the garage", async () => {
    m.auth.current = { user: { id: "u1" }, isLoading: false };
    m.garage.current = { ...m.garage.current, signedIn: true, vehicles: [car(), car({ generationId: "g2", year: 2021, brand: "Geely", brandAr: null, model: "Coolray", isDefault: false })] };
    await open();
    expect(screen.getByText("BYD Seal DM-i")).toBeInTheDocument();                                          // the name, then the generation and the year on their own lines
    expect(screen.getByText("Year 2024")).toBeInTheDocument();
    expect(screen.getByText("Year 2021")).toBeInTheDocument();
    expect(screen.getAllByText("Shopping for this car")).toHaveLength(1);                                 // only the default one
    expect(screen.getAllByRole("link", { name: "Shop for this car" })[1].getAttribute("href")).toBe("/search?generationId=g2&year=2021");
    expect(screen.getAllByRole("button", { name: "Make default" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Make default" }));
    await waitFor(() => expect(m.garage.current.makeDefault).toHaveBeenCalledWith(expect.objectContaining({ generationId: "g2", year: 2021 })));
    fireEvent.click(screen.getByRole("button", { name: "Remove: Geely Coolray · 2021" }));
    await waitFor(() => expect(m.garage.current.remove).toHaveBeenCalledWith(expect.objectContaining({ generationId: "g2" })));
  });

  it("CRITICAL: the car photo is a SQUARE: 250 x 250 on large screens and 130 x 130 on phones, and each button is in the page once (the layout moves them, it does not repeat them)", async () => {
    m.auth.current = { user: { id: "u1" }, isLoading: false };
    m.garage.current = { ...m.garage.current, signedIn: true, vehicles: [car({ generation: "G1", generationPhotoUrl: "/uploads/car.jpg" })] };
    const { container } = await open();
    const frame = container.querySelector("li > div") as HTMLElement;
    expect(frame.className).toContain("size-[130px]");
    expect(frame.className).toContain("sm:size-[250px]");
    expect(frame.className).not.toMatch(/\bh-\d|\bw-\d/);                                  // never a rectangle again (the old h-24 w-36)
    expect(screen.getAllByRole("link", { name: "Shop for this car" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Remove/ })).toHaveLength(1);
    expect(screen.getByText("G1")).toBeInTheDocument();                                            // the generation has its own line
  });

  it("CRITICAL: the page counts the cars ('3 of 5'); with room it offers 'Add a car', and at 5 the form is REPLACED by 'Your garage is full' with the reason", async () => {
    m.auth.current = { user: { id: "u1" }, isLoading: false };
    const cars = (n: number) => Array.from({ length: n }, (_, i) => car({ generationId: `g${i}`, year: 2020 + i, isDefault: i === 0 }));
    m.garage.current = { ...m.garage.current, signedIn: true, vehicles: cars(3) };
    const first = await open();
    expect(screen.getByText(/· 3 of 5/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to my garage" })).toBeInTheDocument();
    expect(screen.queryByText("Your garage is full")).not.toBeInTheDocument();
    first.unmount();
    m.garage.current = { ...m.garage.current, vehicles: cars(5) };
    await open();
    expect(screen.getByText(/· 5 of 5/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your garage is full" })).toBeInTheDocument();
    expect(screen.getByText("You can save up to 5 vehicles. Remove one to add another.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to my garage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add by VIN instead" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Remove/ })).toHaveLength(5);                           // removing is still possible: that is how a place is freed
  });

  it("a buyer who had MORE than 5 before the limit existed sees all of them (nothing hidden) and cannot add; the counter tells the truth", async () => {
    m.auth.current = { user: { id: "u1" }, isLoading: false };
    m.garage.current = { ...m.garage.current, signedIn: true, vehicles: Array.from({ length: 7 }, (_, i) => car({ generationId: `g${i}`, year: 2020, isDefault: i === 0 })) };
    await open();
    expect(screen.getByText(/· 7 of 5/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Remove/ })).toHaveLength(7);
    expect(screen.getByRole("heading", { name: "Your garage is full" })).toBeInTheDocument();
  });

  it("a refusal from the server shows ITS message (in Arabic on the Arabic site); an Arabic buyer reads the same rule", async () => {
    m.auth.current = { user: { id: "u1" }, isLoading: false };
    m.garage.current = { ...m.garage.current, signedIn: true, vehicles: [] };
    await open("ar");
    expect(screen.queryByText("Your garage is full")).not.toBeInTheDocument();
    m.garage.current.add.mockRejectedValueOnce(new Error("يمكنك حفظ 5 مركبات كحد أقصى. احذف إحداها لإضافة مركبة أخرى."));
    fireEvent.click(screen.getByRole("button", { name: "pick a car" }));
    fireEvent.click(screen.getByRole("button", { name: "أضف إلى مركبتي" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("يمكنك حفظ 5 مركبات كحد أقصى");
  });

  it("CRITICAL: a car is added only once a complete brand, model and year is chosen, and a failure is a plain message", async () => {
    m.auth.current = { user: { id: "u1" }, isLoading: false };
    m.garage.current = { ...m.garage.current, signedIn: true, vehicles: [] };
    await open();
    expect(screen.getByText("You have no saved cars yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to my garage" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "pick a car" }));
    m.garage.current.add.mockRejectedValueOnce(new Error(""));                                          // no message from the server: the plain one
    fireEvent.click(screen.getByRole("button", { name: "Add to my garage" }));
    await waitFor(() => expect(m.garage.current.add).toHaveBeenCalledWith("g9", 2020));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect(screen.getByRole("link", { name: "Add by VIN instead" }).getAttribute("href")).toBe("/find?tab=vin");
  });

  it("in Arabic it is مركبتي, with the Arabic brand name and /ar links", async () => {
    m.auth.current = { user: { id: "u1" }, isLoading: false };
    m.garage.current = { ...m.garage.current, signedIn: true, vehicles: [car()] };
    await open("ar");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("مركبتي");
    expect(screen.getByText("بي واي دي Seal DM-i")).toBeInTheDocument();          // the Arabic brand name
    expect(screen.getByText("السنة 2024")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "تسوق لهذه المركبة" }).getAttribute("href")).toBe("/ar/search?generationId=g1&year=2024");
  });
});

describe("wishlist: compare", () => {
  const items = ["a", "b", "c", "d", "e"].map((id) => ({ id, name: `Item ${id}`, images: [], price: 10, currencyCode: "USD", stockQuantity: 3 }));
  const open = async (list = items) => {
    m.wishlist = list;
    m.auth.current = { user: { id: "u1" }, isLoading: false };
    const { default: WishlistPage } = await import("./wishlist/page");
    render(wrap("en", <WishlistPage />));
    await screen.findByText("Item a");
  };

  it("CRITICAL: with two or more saved parts a compare mode picks 2 to 4 of them and opens the comparison", async () => {
    await open();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByText("Pick 2 to 4 parts to compare.")).toBeInTheDocument();
    expect(screen.getByText("Pick at least 2 parts to compare.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Item b" }));
    expect(screen.queryByRole("link", { name: /Compare \(/ })).not.toBeInTheDocument();                 // one is not enough
    fireEvent.click(screen.getByRole("checkbox", { name: "Item d" }));
    expect(screen.getByRole("link", { name: "Compare (2)" }).getAttribute("href")).toBe("/compare?ids=b,d");
  });

  it("CRITICAL: no more than four can be picked (the rest are switched off until one is un-picked)", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    for (const id of ["a", "b", "c", "d"]) fireEvent.click(screen.getByRole("checkbox", { name: `Item ${id}` }));
    expect(screen.getByRole("checkbox", { name: "Item e" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Compare (4)" }).getAttribute("href")).toBe("/compare?ids=a,b,c,d");
    fireEvent.click(screen.getByRole("checkbox", { name: "Item a" }));
    expect(screen.getByRole("checkbox", { name: "Item e" })).toBeEnabled();
  });

  it("Cancel leaves compare mode and forgets the picks; with a single saved part there is nothing to compare", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Item a" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByRole("checkbox", { name: "Item a" })).not.toBeChecked();
  });

  it("with only one saved part there is no compare button", async () => {
    await open([items[0]]);
    expect(screen.queryByRole("button", { name: "Compare" })).not.toBeInTheDocument();
  });
});
