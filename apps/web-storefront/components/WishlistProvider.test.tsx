import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// ONE shared list of the saved parts: loaded once when someone is signed in, changed at once when a heart is pressed, put back if the save fails.
const m = vi.hoisted(() => ({
  auth: { current: { user: { id: "u1" } as { id: string } | null, isLoading: false } },
  token: { current: "tok" as string | null },
  api: { fetchWishlist: vi.fn(), addToWishlist: vi.fn(), removeFromWishlist: vi.fn() },
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => m.auth.current, getAuthToken: () => m.token.current }));
vi.mock("@/lib/api", () => m.api);
import { WishlistProvider, useOptionalWishlist } from "./WishlistProvider";

function Probe({ id = "a" }: { id?: string }) {
  const w = useOptionalWishlist();
  if (!w) return <p>no provider</p>;
  return <div><span data-testid="state">{`${w.signedIn ? "in" : "out"}|${w.ready ? "ready" : "loading"}|${w.isSaved(id) ? "saved" : "not saved"}|${w.isSaved("b") ? "b saved" : "b not saved"}`}</span><button onClick={() => void w.toggle(id)}>toggle</button></div>;
}
const state = () => screen.getByTestId("state").textContent;
const mount = () => render(<WishlistProvider><Probe /></WishlistProvider>);
const items = (...ids: string[]) => ids.map((id) => ({ id }));
beforeEach(() => { vi.clearAllMocks(); m.auth.current = { user: { id: "u1" }, isLoading: false }; m.token.current = "tok"; m.api.fetchWishlist.mockResolvedValue(items("a")); m.api.addToWishlist.mockResolvedValue(undefined); m.api.removeFromWishlist.mockResolvedValue(undefined); });

describe("loading", () => {
  it("signed in: the list is asked for ONCE (with the token) however many hearts read it, and then they know what is saved", async () => {
    render(<WishlistProvider><Probe id="a" /><Probe id="b" /><Probe id="c" /></WishlistProvider>); await waitFor(() => expect(screen.getAllByTestId("state")[0].textContent).toContain("ready"));
    expect(m.api.fetchWishlist).toHaveBeenCalledTimes(1); expect(m.api.fetchWishlist).toHaveBeenCalledWith("tok"); expect(screen.getAllByTestId("state")[0].textContent).toBe("in|ready|saved|b not saved");
  });
  it("it is not ready until the list has come, and a part not in the list is not saved", async () => { let done: (v: unknown) => void = () => {}; m.api.fetchWishlist.mockReturnValue(new Promise((r) => { done = r; })); mount(); expect(state()).toBe("in|loading|not saved|b not saved"); await act(async () => { done(items("b")); }); expect(state()).toBe("in|ready|not saved|b saved"); });
  it("signed out: nothing is asked for, it is ready at once, and signedIn is false", async () => { m.auth.current = { user: null, isLoading: false }; mount(); await waitFor(() => expect(state()).toBe("out|ready|not saved|b not saved")); expect(m.api.fetchWishlist).not.toHaveBeenCalled(); });
  it("while the sign-in is still being checked, nothing is asked for and the hearts are NOT ready yet (they cannot be pressed before we know who is signed in)", () => { m.auth.current = { user: null, isLoading: true }; mount(); expect(m.api.fetchWishlist).not.toHaveBeenCalled(); expect(state()).toBe("out|loading|not saved|b not saved"); });
  it("a failed load leaves the hearts empty (never a wrong 'saved') and ready", async () => { m.api.fetchWishlist.mockRejectedValue(new Error("down")); mount(); await waitFor(() => expect(state()).toBe("in|ready|not saved|b not saved")); });
  it("signing out empties the list; signing in as someone else loads THEIR list", async () => {
    const v = mount(); await waitFor(() => expect(state()).toBe("in|ready|saved|b not saved")); m.auth.current = { user: null, isLoading: false }; v.rerender(<WishlistProvider><Probe /></WishlistProvider>); await waitFor(() => expect(state()).toBe("out|ready|not saved|b not saved"));
    m.auth.current = { user: { id: "u2" }, isLoading: false }; m.api.fetchWishlist.mockResolvedValue(items("b")); v.rerender(<WishlistProvider><Probe /></WishlistProvider>); await waitFor(() => expect(state()).toBe("in|ready|not saved|b saved"));
  });
});
describe("pressing a heart", () => {
  it("saving: the part is saved AT ONCE (before the answer), and the server is told", async () => { let done: () => void = () => {}; m.api.fetchWishlist.mockResolvedValue([]); m.api.addToWishlist.mockReturnValue(new Promise<void>((r) => { done = r; })); mount(); await waitFor(() => expect(state()).toContain("ready")); fireEvent.click(screen.getByText("toggle")); expect(state()).toBe("in|ready|saved|b not saved"); expect(m.api.addToWishlist).toHaveBeenCalledWith("tok", "a"); await act(async () => { done(); }); expect(state()).toBe("in|ready|saved|b not saved"); });
  it("removing: the part is unsaved at once, and the server is told", async () => { mount(); await waitFor(() => expect(state()).toBe("in|ready|saved|b not saved")); fireEvent.click(screen.getByText("toggle")); expect(state()).toBe("in|ready|not saved|b not saved"); await waitFor(() => expect(m.api.removeFromWishlist).toHaveBeenCalledWith("tok", "a")); });
  it("a save that FAILS goes back to how it was (and so does a failed removal)", async () => {
    m.api.fetchWishlist.mockResolvedValue([]); m.api.addToWishlist.mockRejectedValue(new Error("no")); const v = mount(); await waitFor(() => expect(state()).toContain("ready")); fireEvent.click(screen.getByText("toggle")); await waitFor(() => expect(state()).toBe("in|ready|not saved|b not saved")); v.unmount();
    m.api.fetchWishlist.mockResolvedValue(items("a")); m.api.removeFromWishlist.mockRejectedValue(new Error("no")); mount(); await waitFor(() => expect(state()).toBe("in|ready|saved|b not saved")); fireEvent.click(screen.getByText("toggle")); await waitFor(() => expect(m.api.removeFromWishlist).toHaveBeenCalled()); await waitFor(() => expect(state()).toBe("in|ready|saved|b not saved"));
  });
  it("a second press while the first is still on its way is ignored (one request, not a save and an unsave)", async () => { let done: () => void = () => {}; m.api.fetchWishlist.mockResolvedValue([]); m.api.addToWishlist.mockReturnValue(new Promise<void>((r) => { done = r; })); mount(); await waitFor(() => expect(state()).toContain("ready")); fireEvent.click(screen.getByText("toggle")); fireEvent.click(screen.getByText("toggle")); expect(m.api.addToWishlist).toHaveBeenCalledTimes(1); expect(m.api.removeFromWishlist).not.toHaveBeenCalled(); await act(async () => { done(); }); });
  it("without a token nothing happens (no change, no request)", async () => { m.token.current = null; mount(); await waitFor(() => expect(state()).toContain("ready")); fireEvent.click(screen.getByText("toggle")); expect(m.api.addToWishlist).not.toHaveBeenCalled(); expect(m.api.removeFromWishlist).not.toHaveBeenCalled(); });
});
describe("without a provider", () => { it("useOptionalWishlist is null (a heart then draws nothing)", () => { render(<Probe />); expect(screen.getByText("no provider")).toBeInTheDocument(); }); });
