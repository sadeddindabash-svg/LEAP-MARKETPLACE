import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SavedAddress } from "@/lib/api";

// The address book and the order confirmation page, with the server, the sign-in state and the location lookup replaced by fixed values.
const m = vi.hoisted(() => ({
  user: { current: null as { id: string; email: string } | null },
  params: { current: new URLSearchParams() },
  list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: m.user.current, isLoading: false }), getAuthToken: () => (m.user.current ? "tok" : null) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => m.params.current, usePathname: () => "/" }));
vi.mock("@/lib/api", () => ({
  fetchMyAddresses: (...a: unknown[]) => m.list(...a), createAddress: (...a: unknown[]) => m.create(...a), updateAddress: (...a: unknown[]) => m.update(...a), deleteAddress: (...a: unknown[]) => m.remove(...a),
}));
vi.mock("@/lib/nominatim", () => ({ currentPosition: async () => null, reverseGeocode: async () => null }));

import AddressesPage from "./addresses/page";
import ConfirmationPage from "./checkout/confirmation/page";
import { LangProvider } from "@/components/LangProvider";
import { COUNTRIES } from "@/lib/countries";

const saved = (over: Partial<SavedAddress> = {}): SavedAddress => ({ id: "a1", label: "Home", recipientName: "Sam", phone: "+968 1", country: "Oman", city: "Muscat", streetAddress: "1 Main St", postalCode: null, isDefault: false, createdAt: "x", ...over });
const show = (node: React.ReactNode, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}>{node}</LangProvider>);
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fill = (over: { country?: string } = {}) => { type("Label (e.g. Home, Work)", "Work"); type("Recipient name", "Sam"); type("Phone", "+968 9000"); type("Country", over.country ?? "Oman"); type("City", "Muscat"); type("Street address", "5 Side St"); };

beforeEach(() => {
  vi.clearAllMocks();
  m.user.current = { id: "u1", email: "buyer@leap.dev" };
  m.params.current = new URLSearchParams();
  m.list.mockResolvedValue([saved({ id: "a1", isDefault: true }), saved({ id: "a2", label: "Work", city: "Sohar" })]);
  m.create.mockResolvedValue({}); m.update.mockResolvedValue({}); m.remove.mockResolvedValue(undefined);
});

describe("address book", () => {
  it("a visitor who is not signed in is asked to sign in instead of seeing an address book", () => {
    m.user.current = null;
    show(<AddressesPage />);
    expect(screen.getByText("Sign in to manage your addresses.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(m.list).not.toHaveBeenCalled();
  });

  it("CRITICAL: lists the saved addresses with the default one marked, and shows the country in the page's language", async () => {
    show(<AddressesPage />);
    expect(await screen.findByText("1 Main St, Muscat, Oman")).toBeInTheDocument();
    const home = screen.getByText("Home").closest("li") as HTMLElement;
    expect(within(home).getByText("Default")).toBeInTheDocument();
    expect(within(home).queryByRole("button", { name: "Set as default" })).not.toBeInTheDocument();
    const work = screen.getByText("Work").closest("li") as HTMLElement;
    expect(within(work).getByRole("button", { name: "Set as default" })).toBeInTheDocument();
  });

  it("in Arabic the page and the country names are Arabic", async () => {
    show(<AddressesPage />, "ar");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("العناوين");
    const omanAr = COUNTRIES.find((c) => c.en === "Oman")!.ar;
    expect(screen.getAllByText(new RegExp(`(Muscat|Sohar), ${omanAr}$`)).length).toBe(2);         // the city is what the buyer typed; the COUNTRY is shown in Arabic
    expect(screen.queryByText(/Muscat, Oman/)).not.toBeInTheDocument();
    expect(screen.getAllByText("افتراضي").length).toBe(1);
  });

  it("CRITICAL: adding checks everything first (label, fields, the Saudi code) and then saves in the server's form, and the list is loaded again", async () => {
    m.list.mockResolvedValue([]);
    show(<AddressesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add address" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Please fill in every field.")).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();
    fill({ country: "Saudi Arabia" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Must be 4 letters followed by 4 numbers/)).toBeInTheDocument();
    type("Address Code", "rrrd2929");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    expect(m.create.mock.lastCall).toEqual(["tok", { label: "Work", recipientName: "Sam", phone: "+968 9000", country: "Saudi Arabia", state: null, city: "Muscat", streetAddress: "5 Side St", postalCode: null, nationalAddress: "RRRD2929" }]);
    expect(await screen.findByText("Address saved")).toBeInTheDocument();
    expect(m.list).toHaveBeenCalledTimes(2);                                                       // opened, then again after saving
  });

  it("editing starts from what is saved and saves the changes to that address", async () => {
    show(<AddressesPage />);
    const home = (await screen.findByText("Home")).closest("li") as HTMLElement;
    fireEvent.click(within(home).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("City")).toHaveValue("Muscat");
    type("City", "Salalah");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.update).toHaveBeenCalledTimes(1));
    expect(m.update.mock.lastCall?.[0]).toBe("tok");
    expect(m.update.mock.lastCall?.[1]).toBe("a1");
    expect(m.update.mock.lastCall?.[2]).toMatchObject({ city: "Salalah", label: "Home", country: "Oman" });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("CRITICAL: making an address the default changes only the default, and says so", async () => {
    show(<AddressesPage />);
    const work = (await screen.findByText("Work")).closest("li") as HTMLElement;
    fireEvent.click(within(work).getByRole("button", { name: "Set as default" }));
    await waitFor(() => expect(m.update).toHaveBeenCalledWith("tok", "a2", { isDefault: true }));
    expect(await screen.findByText("Set as your default address")).toBeInTheDocument();
  });

  it("CRITICAL: deleting asks first; Cancel changes nothing; Delete removes that address", async () => {
    show(<AddressesPage />);
    const work = (await screen.findByText("Work")).closest("li") as HTMLElement;
    fireEvent.click(within(work).getByRole("button", { name: "Delete" }));
    expect(within(work).getByText("Delete this address?")).toBeInTheDocument();
    fireEvent.click(within(work).getByRole("button", { name: "Cancel" }));
    expect(m.remove).not.toHaveBeenCalled();
    fireEvent.click(within(work).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(work).getAllByRole("button", { name: "Delete" })[0]);
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith("tok", "a2"));
    expect(await screen.findByText("Address deleted")).toBeInTheDocument();
  });

  it("CRITICAL: at three addresses (the server's limit) adding is off and the reason is given", async () => {
    m.list.mockResolvedValue([saved({ id: "a1" }), saved({ id: "a2" }), saved({ id: "a3" })]);
    show(<AddressesPage />);
    await screen.findAllByText("Home");
    expect(screen.getByRole("button", { name: "Add address" })).toBeDisabled();
    expect(screen.getByText("You can save up to 3 addresses. Delete one before adding another.")).toBeInTheDocument();
  });

  it("a refusal from the server is shown to the buyer (the form stays open)", async () => {
    m.list.mockResolvedValue([]);
    m.create.mockRejectedValue(new Error("You can save up to 3 addresses."));
    show(<AddressesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add address" }));
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can save up to 3 addresses.");
    expect(screen.getByLabelText("City")).toBeInTheDocument();
  });
});

describe("order confirmation", () => {
  it("CRITICAL: names the order, and offers a GUEST to keep their order history in an account (their email carried to sign-up); 'Maybe later' closes it", () => {
    m.user.current = null;
    m.params.current = new URLSearchParams("orderId=ord_7&guestEmail=sam%40example.com");
    show(<ConfirmationPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Order placed");
    expect(screen.getByText("Order ord_7 placed successfully")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" }).getAttribute("href")).toBe("/signup?email=sam%40example.com");
    expect(screen.queryByRole("link", { name: "View your order" })).not.toBeInTheDocument();       // order pages for guests come with the orders stage
    fireEvent.click(screen.getByRole("button", { name: "Maybe later" }));
    expect(screen.queryByText("Save your order history")).not.toBeInTheDocument();
  });

  it("a signed-in buyer is not asked to create an account, and can open their order", () => {
    m.params.current = new URLSearchParams("orderId=ord_7");
    show(<ConfirmationPage />);
    expect(screen.queryByText("Save your order history")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View your order" }).getAttribute("href")).toBe("/orders/ord_7");
  });

  it("in Arabic it is Arabic and every link keeps /ar", () => {
    m.user.current = null;
    m.params.current = new URLSearchParams("orderId=ord_7&guestEmail=sam%40example.com");
    show(<ConfirmationPage />, "ar");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("تم تقديم الطلب");
    expect(screen.getByText("تم تقديم الطلب ord_7 بنجاح")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "إنشاء حساب" }).getAttribute("href")).toBe("/ar/signup?email=sam%40example.com");
    expect(screen.getByRole("link", { name: "متابعة التسوق" }).getAttribute("href")).toBe("/ar/search");
  });
});
