import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// The support, returns, contact and bug report pages, with the server, the sign-in state and the router replaced by fixed values.
const m = vi.hoisted(() => ({
  user: { current: null as { id: string; email: string } | null },
  params: { current: new URLSearchParams() },
  route: { current: { id: "T-1" } },
  push: vi.fn(),
  api: { fetchMyTickets: vi.fn(), createSupportTicket: vi.fn(), fetchSupportTicket: vi.fn(), sendSupportTicketMessage: vi.fn(), submitTicketFeedback: vi.fn(), fetchMyReturnCases: vi.fn(), fetchReturnCase: vi.fn(), sendReturnCaseMessage: vi.fn(), submitBugReport: vi.fn(), uploadReviewPhoto: vi.fn() },
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: m.user.current, isLoading: false }), getAuthToken: () => (m.user.current ? "tok" : null) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: vi.fn() }), useSearchParams: () => m.params.current, useParams: () => m.route.current, usePathname: () => "/support" }));
vi.mock("@/lib/api", () => ({
  ...Object.fromEntries(Object.keys(m.api).map((k) => [k, (...a: unknown[]) => (m.api as Record<string, (...x: unknown[]) => unknown>)[k](...a)])),
  resolveImageUrl: (u: string) => u,
}));

import SupportPage from "./support/page";
import TicketPage from "./support/[id]/page";
import ReturnsPage from "./returns/page";
import ReturnCasePage from "./returns/[id]/page";
import ContactPage, { generateMetadata as contactMeta } from "./contact/page";
import ReportBugPage from "./report-bug/page";
import { LangProvider } from "@/components/LangProvider";

vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => lang.current) }));
const lang = vi.hoisted(() => ({ current: "en" as "en" | "ar" }));

const ticket = (over: Record<string, unknown> = {}) => ({ id: "T-1", subject: "Wrong part", buyerId: null, guestEmail: "sam@example.com", orderId: null, status: "open", priority: "medium", createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-02T10:00:00Z", resolutionHelpful: null,
  messages: [{ senderRole: "buyer", message: "It does not fit", createdAt: "2026-10-01T10:00:00Z" }, { senderRole: "admin", message: "We are checking", createdAt: "2026-10-02T10:00:00Z" }], ...over });
const show = (node: React.ReactNode, l: "en" | "ar" = "en") => render(<LangProvider lang={l}>{node}</LangProvider>);
const buyer = () => { m.user.current = { id: "u1", email: "buyer@leap.dev" }; };
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  m.user.current = null; m.params.current = new URLSearchParams(); m.route.current = { id: "T-1" }; lang.current = "en";
  m.api.fetchMyTickets.mockResolvedValue([]); m.api.createSupportTicket.mockResolvedValue({ id: "T-9" }); m.api.fetchSupportTicket.mockResolvedValue(ticket());
  m.api.sendSupportTicketMessage.mockResolvedValue(undefined); m.api.submitTicketFeedback.mockResolvedValue({ id: "T-1", resolutionHelpful: true });
  m.api.fetchMyReturnCases.mockResolvedValue([]); m.api.sendReturnCaseMessage.mockResolvedValue(undefined);
  m.api.fetchReturnCase.mockResolvedValue({ id: "RC-1", orderId: "ord_1", subOrderId: 5, buyerId: null, guestEmail: "sam@example.com", reason: "Damaged", status: "awaiting", createdAt: "x", updatedAt: "x", photos: ["/uploads/a.jpg"], messages: [{ senderRole: "buyer", message: "Cracked", createdAt: "2026-10-01T10:00:00Z" }, { senderRole: "admin", message: "Sorry, we will arrange it", createdAt: "2026-10-02T10:00:00Z" }] });
  m.api.submitBugReport.mockResolvedValue({ id: 1, createdAt: "x" }); m.api.uploadReviewPhoto.mockResolvedValue("/uploads/shot.png");
});
afterEach(() => { vi.useRealTimers(); });

describe("support: the list and a new ticket", () => {
  it("CRITICAL: a guest can open a ticket (an email is needed and must look like one) and lands on it with their email in the address", async () => {
    show(<SupportPage />);
    expect(screen.getByText("You're messaging the Leap team, not the supplier directly.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please fill in both fields.");
    type("Subject", "Wrong part"); type("How can we help?", "It does not fit");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please provide an email so we can reach you.");
    fireEvent.change(screen.getByLabelText("Email", { selector: "#nt-email" }), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That doesn't look like a valid email address.");
    expect(m.api.createSupportTicket).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Email", { selector: "#nt-email" }), { target: { value: "sam@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(m.api.createSupportTicket).toHaveBeenCalledTimes(1));
    expect(m.api.createSupportTicket.mock.lastCall).toEqual([{ subject: "Wrong part", message: "It does not fit" }, { guestEmail: "sam@example.com" }]);
    await waitFor(() => expect(m.push.mock.lastCall?.[0]).toBe("/support/T-9?guestEmail=sam%40example.com"));
  });

  it("CRITICAL: a guest can track a ticket with its ID and email (both needed)", () => {
    show(<SupportPage />);
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(screen.getAllByRole("alert").some((a) => a.textContent === "Please fill in both fields.")).toBe(true);
    type("Ticket ID", " T-77 "); fireEvent.change(screen.getByLabelText("Email", { selector: "#tk-email" }), { target: { value: "sam@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(m.push.mock.lastCall?.[0]).toBe("/support/T-77?guestEmail=sam%40example.com");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });

  it("CRITICAL: a signed-in buyer sees how many tickets they have, how many are open and resolved, and each with its status; no email asked", async () => {
    buyer();
    m.api.fetchMyTickets.mockResolvedValue([{ id: "T-1", subject: "Wrong part", status: "open" }, { id: "T-2", subject: "Late parcel", status: "in_progress" }, { id: "T-3", subject: "Refund", status: "resolved" }, { id: "T-4", subject: "Old", status: "closed" }]);
    show(<SupportPage />);
    expect(await screen.findByText("Wrong part")).toBeInTheDocument();
    expect(m.api.fetchMyTickets).toHaveBeenCalledWith("tok");
    const stat = (label: string) => screen.getByText(label, { selector: "p" }).previousElementSibling?.textContent;
    expect([stat("Total tickets"), stat("Open requests"), stat("Resolved")]).toEqual(["4", "2", "2"]);
    expect(within(screen.getByText("Refund").closest("a") as HTMLElement).getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("Wrong part").closest("a")?.getAttribute("href")).toBe("/support/T-1");
    expect(screen.queryByLabelText("Subject")).not.toBeInTheDocument();                                      // the form opens with the button
    fireEvent.click(screen.getByRole("button", { name: "New ticket" }));
    expect(screen.queryByLabelText("Email", { selector: "#nt-email" })).not.toBeInTheDocument();
    type("Subject", "Another"); type("How can we help?", "Please help");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(m.api.createSupportTicket).toHaveBeenCalled());
    expect(m.api.createSupportTicket.mock.lastCall).toEqual([{ subject: "Another", message: "Please help" }, { token: "tok" }]);
    await waitFor(() => expect(m.push.mock.lastCall?.[0]).toBe("/support/T-9"));
  });

  it("a ticket about an order (?orderId=) opens the form at once and carries the order; an empty list says so; Arabic is Arabic with /ar links", async () => {
    buyer();
    m.params.current = new URLSearchParams("orderId=ord_5");
    const first = show(<SupportPage />);
    expect(screen.getByLabelText("Subject")).toBeInTheDocument();
    type("Subject", "About my order"); type("How can we help?", "Late");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(m.api.createSupportTicket.mock.lastCall?.[0]).toEqual({ subject: "About my order", message: "Late", orderId: "ord_5" }));
    expect(await screen.findByText("No support tickets yet. Tap + to start one.")).toBeInTheDocument();
    first.unmount();
    m.params.current = new URLSearchParams();
    m.api.fetchMyTickets.mockResolvedValue([{ id: "T-1", subject: "Wrong part", status: "open" }]);
    show(<SupportPage />, "ar");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("دعم ليب");
    expect(screen.getByText("Wrong part").closest("a")?.getAttribute("href")).toBe("/ar/support/T-1");
    expect(screen.getByText("مفتوحة")).toBeInTheDocument();
  });
});

describe("support: a ticket's conversation", () => {
  const open = (search = "guestEmail=sam%40example.com", l: "en" | "ar" = "en") => { m.params.current = new URLSearchParams(search); return show(<TicketPage />, l); };

  it("CRITICAL: a guest opening a ticket without the email in the address is asked for it (the app's prompt), then taken to it", () => {
    show(<TicketPage />);
    expect(screen.getByText("Enter the email this ticket was filed under to view it.")).toBeInTheDocument();
    expect(m.api.fetchSupportTicket).not.toHaveBeenCalled();
    type("Email", "sam@example.com");
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(m.push.mock.lastCall?.[0]).toBe("/support/T-1?guestEmail=sam%40example.com");
  });

  it("CRITICAL: shows the conversation (the team's messages apart from the buyer's), and replying sends it and shows it", async () => {
    open();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Wrong part");
    expect(m.api.fetchSupportTicket).toHaveBeenCalledWith("T-1", { token: undefined, guestEmail: "sam@example.com" });
    expect(screen.getByText("We are checking").closest("li")).toHaveClass("justify-start");              // the Leap team
    expect(screen.getByText("It does not fit").closest("li")).toHaveClass("justify-end");                 // the buyer
    expect(screen.getByText("Open")).toBeInTheDocument();
    m.api.fetchSupportTicket.mockResolvedValue(ticket({ messages: [...ticket().messages, { senderRole: "buyer", message: "Any news?", createdAt: "2026-10-03T10:00:00Z" }] }));
    type("Type a message…", "Any news?");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(m.api.sendSupportTicketMessage).toHaveBeenCalledWith("T-1", "Any news?", { token: undefined, guestEmail: "sam@example.com" }));
    expect(await screen.findByText("Any news?", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByLabelText("Type a message…")).toHaveValue("");
  });

  it("a signed-in buyer needs no email in the address", async () => {
    buyer(); m.params.current = new URLSearchParams();
    show(<TicketPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(m.api.fetchSupportTicket).toHaveBeenCalledWith("T-1", { token: "tok", guestEmail: undefined });
  });

  it("CRITICAL: 'Was this resolution helpful?' appears only for a resolved or closed ticket not yet answered; answering sends it and thanks the buyer", async () => {
    m.api.fetchSupportTicket.mockResolvedValue(ticket({ status: "resolved" }));
    open();
    expect(await screen.findByText("Was this resolution helpful?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(m.api.submitTicketFeedback).toHaveBeenCalledWith("T-1", true, { token: undefined, guestEmail: "sam@example.com" }));
    expect(await screen.findByText("Thanks for letting us know!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yes" })).not.toBeInTheDocument();
  });

  it("CRITICAL: no feedback question for an open ticket, nor for one already answered (yes or no); a refusal is shown", async () => {
    const a = open();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Was this resolution helpful?")).not.toBeInTheDocument();
    a.unmount();
    m.api.fetchSupportTicket.mockResolvedValue(ticket({ status: "closed", resolutionHelpful: false }));
    const b = open();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Was this resolution helpful?")).not.toBeInTheDocument();
    b.unmount();
    m.api.fetchSupportTicket.mockResolvedValue(ticket({ status: "resolved" }));
    m.api.submitTicketFeedback.mockRejectedValue(new Error("Feedback can only be given once this ticket is resolved."));
    open();
    fireEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Feedback can only be given once this ticket is resolved.");
  });

  it("CRITICAL: it refreshes every 5 seconds while open and stops when left; not found and a failed load say so", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = open();
    await screen.findByRole("heading", { level: 1 });
    expect(m.api.fetchSupportTicket).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(m.api.fetchSupportTicket).toHaveBeenCalledTimes(2);
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(m.api.fetchSupportTicket).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    m.api.fetchSupportTicket.mockRejectedValue(new Error("Ticket not found"));
    const b = open();
    expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
    b.unmount();
    m.api.fetchSupportTicket.mockRejectedValue(new Error("Failed to load ticket (500)"));
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this ticket. Failed to load ticket (500)");
  });

  it("in Arabic the conversation and the feedback question are Arabic", async () => {
    m.api.fetchSupportTicket.mockResolvedValue(ticket({ status: "resolved" }));
    open("guestEmail=sam%40example.com", "ar");
    expect(await screen.findByText("هل كان هذا الحل مفيدًا؟")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "نعم" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "لا" })).toBeInTheDocument();
    expect(screen.getByText("تم الحل")).toBeInTheDocument();
    expect(screen.getByLabelText("اكتب رسالة…")).toBeInTheDocument();
  });
});

describe("returns", () => {
  it("CRITICAL: a signed-in buyer's returns show the reason, the order and the status; a guest is told to sign in and can track one with its ID and email", async () => {
    show(<ReturnsPage />);
    expect(screen.getByText("Log in to see all your returns")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please fill in both fields.");
    type("Return case ID", "RC-5"); type("Email", "sam@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(m.push.mock.lastCall?.[0]).toBe("/returns/RC-5?guestEmail=sam%40example.com");
  });

  it("CRITICAL: signed in, every return is listed with its reason, order and status (and Arabic status words)", async () => {
    buyer();
    m.api.fetchMyReturnCases.mockResolvedValue([{ id: "RC-1", orderId: "ord_1", subOrderId: 5, reason: "Damaged", status: "awaiting", updatedAt: "x" }, { id: "RC-2", orderId: "ord_2", subOrderId: 6, reason: "Wrong item", status: "completed", updatedAt: "x" }]);
    const first = show(<ReturnsPage />);
    expect(await screen.findByText("Damaged")).toBeInTheDocument();
    expect(m.api.fetchMyReturnCases).toHaveBeenCalledWith("tok");
    const row = screen.getByText("Damaged").closest("a") as HTMLElement;
    expect(row.getAttribute("href")).toBe("/returns/RC-1");
    expect(within(row).getByText("ord_1")).toBeInTheDocument();
    expect(within(row).getByText("Awaiting review")).toBeInTheDocument();
    expect(within(screen.getByText("Wrong item").closest("a") as HTMLElement).getByText("Completed")).toBeInTheDocument();
    first.unmount();
    show(<ReturnsPage />, "ar");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("مرتجعاتي");
    expect(screen.getByText("Damaged").closest("a")?.getAttribute("href")).toBe("/ar/returns/RC-1");
    expect(screen.getByText("قيد المراجعة")).toBeInTheDocument();
  });

  it("an empty list says so", async () => {
    buyer();
    show(<ReturnsPage />);
    expect(await screen.findByText("No return requests yet.")).toBeInTheDocument();
  });

  const openCase = (search = "guestEmail=sam%40example.com") => { m.route.current = { id: "RC-1" }; m.params.current = new URLSearchParams(search); return show(<ReturnCasePage />); };
  it("CRITICAL: a return's conversation shows its photos, the reason, the order (linked with the guest's email) and the messages, and a reply is sent", async () => {
    openCase();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Damaged");
    expect(m.api.fetchReturnCase).toHaveBeenCalledWith("RC-1", { token: undefined, guestEmail: "sam@example.com" });
    expect(screen.getByRole("link", { name: "ord_1" }).getAttribute("href")).toBe("/orders/ord_1?guestEmail=sam%40example.com");
    expect(screen.getByAltText("Photos")).toBeInTheDocument();
    expect(screen.getByText("Sorry, we will arrange it").closest("li")).toHaveClass("justify-start");
    type("Type a message…", "Thank you");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(m.api.sendReturnCaseMessage).toHaveBeenCalledWith("RC-1", "Thank you", { token: undefined, guestEmail: "sam@example.com" }));
  });

  it("a guest without the email is asked for it; the return refreshes every 5 seconds; a case that is not there says 'Not found'", async () => {
    m.route.current = { id: "RC-1" };
    const a = show(<ReturnCasePage />);
    expect(screen.getByText("Enter the email this return was filed under to view it.")).toBeInTheDocument();
    a.unmount();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const b = openCase();
    await screen.findByRole("heading", { level: 1 });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(m.api.fetchReturnCase).toHaveBeenCalledTimes(2);
    b.unmount();
    vi.useRealTimers();
    m.api.fetchReturnCase.mockRejectedValue(new Error("Return case not found"));
    openCase();
    expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
  });
});

describe("contact us and report a bug", () => {
  it("CRITICAL: contact us offers support and a bug report (in both languages), is indexable and has its own language alternates", async () => {
    render(<LangProvider lang="en">{await ContactPage()}</LangProvider>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Contact us");
    expect(screen.getByRole("link", { name: /Support/ }).getAttribute("href")).toBe("/support");
    expect(screen.getByRole("link", { name: /Report a bug/ }).getAttribute("href")).toBe("/report-bug");
    const meta = await contactMeta();
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.languages).toMatchObject({ en: expect.stringMatching(/\/contact$/), ar: expect.stringMatching(/\/ar\/contact$/) });
    lang.current = "ar";
    render(<LangProvider lang="ar">{await ContactPage()}</LangProvider>);
    expect(screen.getAllByRole("heading", { level: 1 }).at(-1)).toHaveTextContent("تواصل معنا");
    expect(screen.getAllByRole("link", { name: /الدعم/ }).at(-1)?.getAttribute("href")).toBe("/ar/support");
  });

  it("CRITICAL: a guest's bug report needs a description and is sent with what the browser is; no screenshot (they are told); then it is thanked", async () => {
    show(<ReportBugPage />);
    expect(screen.getByText("A screenshot can be attached when you are signed in.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Attach a screenshot (optional)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please fill in every field.");
    expect(m.api.submitBugReport).not.toHaveBeenCalled();
    type("What happened?", "  The cart page froze  ");
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(m.api.submitBugReport).toHaveBeenCalledTimes(1));
    const [body, token] = m.api.submitBugReport.mock.lastCall as [{ description: string; screenshotUrl: string | null; deviceInfo: string }, string | null];
    expect(body.description).toBe("The cart page froze");
    expect(body.screenshotUrl).toBeNull();
    expect(body.deviceInfo).toMatch(/^Web/);
    expect(token).toBeNull();
    expect(await screen.findByText("Thank you. We received your report.")).toBeInTheDocument();
  });

  it("a signed-in buyer's screenshot is uploaded first and goes with the report; a failure gives the app's message and keeps what was typed", async () => {
    buyer();
    show(<ReportBugPage />);
    type("What happened?", "Checkout error");
    fireEvent.change(screen.getByLabelText("Attach a screenshot (optional)"), { target: { files: [new File(["x"], "shot.png", { type: "image/png" })] } });
    expect(screen.getByText("Screenshot attached ✓")).toBeInTheDocument();
    m.api.submitBugReport.mockRejectedValueOnce(new Error("down"));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not submit your report. Please try again.");
    expect(screen.getByLabelText("What happened?")).toHaveValue("Checkout error");
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(m.api.submitBugReport).toHaveBeenCalledTimes(2));
    expect(m.api.uploadReviewPhoto).toHaveBeenCalledWith("tok", expect.any(File));
    expect(m.api.submitBugReport.mock.lastCall?.[0]).toMatchObject({ description: "Checkout error", screenshotUrl: "/uploads/shot.png" });
    expect(m.api.submitBugReport.mock.lastCall?.[1]).toBe("tok");
  });

  it("CRITICAL: a screenshot the server refuses (too small, not an image) shows the server's reason, and no report is sent without it", async () => {
    buyer();
    m.api.uploadReviewPhoto.mockRejectedValue(new Error("Image resolution too low (300x200). Shortest side must be at least 800px."));
    show(<ReportBugPage />);
    type("What happened?", "Checkout error");
    fireEvent.change(screen.getByLabelText("Attach a screenshot (optional)"), { target: { files: [new File(["x"], "small.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Image resolution too low (300x200). Shortest side must be at least 800px.");
    expect(m.api.submitBugReport).not.toHaveBeenCalled();
    expect(screen.getByLabelText("What happened?")).toHaveValue("Checkout error");
  });

  it("the bug report page is Arabic in Arabic", () => {
    show(<ReportBugPage />, "ar");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("الإبلاغ عن مشكلة");
    expect(screen.getByLabelText("ماذا حدث؟")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إرسال البلاغ" })).toBeInTheDocument();
  });
});
