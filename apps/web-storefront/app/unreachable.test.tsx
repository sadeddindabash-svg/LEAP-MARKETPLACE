import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// What a visitor sees when the shop cannot be reached: the search page says so, the error page explains and offers to try again.
const m = vi.hoisted(() => ({ unreachable: { current: true } }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => "en") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/search" }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: null, isLoading: false }), getAuthToken: () => null }));
vi.mock("@/lib/api", () => ({ fetchCategories: vi.fn(async () => []), fetchProductsPaginated: vi.fn(async () => (m.unreachable.current ? { items: [], total: 0, unreachable: true } : { items: [], total: 0 })),
  fetchVehicleBrands: vi.fn(async () => []), fetchModelsForBrand: vi.fn(async () => []), fetchGenerationsForModel: vi.fn(async () => []), resolveImageUrl: (u: string) => u }));

import SearchPage from "./search/page";
import ErrorPage from "./error";
import { LangProvider } from "@/components/LangProvider";

describe("when the shop cannot be reached", () => {
  it("CRITICAL: the search page says the shop cannot be reached, instead of claiming that no part matches", async () => {
    m.unreachable.current = true;
    render(<LangProvider lang="en">{await SearchPage({ searchParams: Promise.resolve({ q: "disc" }) })}</LangProvider>);
    expect(screen.getByText("We can't reach the shop right now. Please try again in a moment.")).toBeInTheDocument();
    expect(screen.queryByText(/No parts match your search/)).not.toBeInTheDocument();
  });
  it("a normal search with no results still says no part matches", async () => {
    m.unreachable.current = false;
    render(<LangProvider lang="en">{await SearchPage({ searchParams: Promise.resolve({ q: "disc" }) })}</LangProvider>);
    expect(screen.getByText("No parts match your search. Try a different term or category.")).toBeInTheDocument();
  });
  it("CRITICAL: the error page explains, never shows technical details, and Try again retries; in Arabic it is Arabic", () => {
    const reset = vi.fn();
    const first = render(<LangProvider lang="en"><ErrorPage error={Object.assign(new Error("secret internal detail"), { digest: "abc" })} reset={reset} /></LangProvider>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page could not be loaded");
    expect(screen.queryByText(/secret internal detail|abc/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
    first.unmount();
    render(<LangProvider lang="ar"><ErrorPage error={new Error("x")} reset={reset} /></LangProvider>);
    expect(screen.getByRole("button", { name: "حاول مرة أخرى" })).toBeInTheDocument();
  });
});
