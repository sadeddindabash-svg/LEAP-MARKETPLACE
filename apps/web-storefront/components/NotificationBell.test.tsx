import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

// The bell that shows the number of unread notifications, with the server and the sign-in state replaced by fixed values.
const m = vi.hoisted(() => ({
  auth: { current: { user: { id: "u1" } as { id: string } | null, isLoading: false } },
  count: vi.fn<(token: string) => Promise<number>>(),
}));
vi.mock("./AuthProvider", () => ({ useAuth: () => m.auth.current, getAuthToken: () => "tok" }));
vi.mock("@/lib/api", () => ({ fetchUnreadNotificationCount: (token: string) => m.count(token) }));

import NotificationBell from "./NotificationBell";
import { LangProvider } from "./LangProvider";

const show = () => render(<LangProvider lang="en"><NotificationBell /></LangProvider>);
const settle = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
const afterSeconds = async (s: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(s * 1000); }); };
class NetworkError extends TypeError { constructor() { super("We can't reach the server. Please check your connection and try again."); this.name = "NetworkError"; } }

beforeEach(() => { vi.useFakeTimers(); m.count.mockReset(); m.auth.current = { user: { id: "u1" }, isLoading: false }; });
afterEach(() => { vi.useRealTimers(); });

describe("the notification bell", () => {
  it("shows the unread number, and nothing when there are none", async () => {
    m.count.mockResolvedValue(3);
    show(); await settle();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(m.count).toHaveBeenCalledWith("tok");
  });

  it("CRITICAL: when the server cannot be reached the page keeps working: no error is thrown (it would fill the screen with an error), the bell is simply shown without a number", async () => {
    m.count.mockRejectedValue(new NetworkError());
    show(); await settle();                                  // an unhandled failure here would make this test fail
    expect(screen.getByRole("link")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("CRITICAL: a check that fails later keeps the last number, and the next check (30 seconds later) updates it again once the server is back", async () => {
    m.count.mockResolvedValueOnce(2);
    show(); await settle();
    expect(screen.getByText("2")).toBeInTheDocument();
    m.count.mockRejectedValueOnce(new NetworkError());       // the server goes down for one check
    await afterSeconds(30);
    expect(screen.getByText("2")).toBeInTheDocument();       // still the last known number
    m.count.mockResolvedValueOnce(5);                        // and comes back
    await afterSeconds(30);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(m.count).toHaveBeenCalledTimes(3);
  });

  it("signed out there is no bell and nothing is asked of the server", async () => {
    m.auth.current = { user: null, isLoading: false };
    const { container } = show(); await settle();
    expect(container).toBeEmptyDOMElement();
    expect(m.count).not.toHaveBeenCalled();
  });
});
