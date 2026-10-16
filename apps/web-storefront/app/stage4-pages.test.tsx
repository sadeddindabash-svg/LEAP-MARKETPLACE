import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// The sign-in pages and the account area, with the sign-in state, the server and the router replaced by fixed values.
const m = vi.hoisted(() => ({
  auth: { current: null as Record<string, unknown> | null },
  push: vi.fn(),
  params: { current: new URLSearchParams() },
  path: { current: "/account" },
  api: { fetchLoyaltyStatus: vi.fn(), fetchMyGarage: vi.fn(), fetchMyOrders: vi.fn(), fetchWishlist: vi.fn(), fetchUnreadNotificationCount: vi.fn(), updateAvatar: vi.fn(), uploadReviewPhoto: vi.fn(),
    deleteAccount: vi.fn(), changeEmail: vi.fn(), setupTwoFactor: vi.fn(), confirmTwoFactor: vi.fn(), disableTwoFactor: vi.fn(), forgotPassword: vi.fn() },
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => m.auth.current, getAuthToken: () => "tok" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: vi.fn() }), useSearchParams: () => m.params.current, usePathname: () => m.path.current }));
vi.mock("@/lib/api", () => ({ ...Object.fromEntries(Object.entries(m.api).map(([k]) => [k, (...a: unknown[]) => (m.api as unknown as Record<string, (...args: unknown[]) => unknown>)[k](...a)])), resolveImageUrl: (u: string) => u }));

import LoginPage from "./login/page";
import SignupPage from "./signup/page";
import ForgotPasswordPage from "./forgot-password/page";
import AccountPage from "./account/page";
import LoyaltyPage from "./account/loyalty/page";
import ChangeEmailPage from "./account/change-email/page";
import TwoFactorPage from "./account/two-factor/page";
import AccountShell from "@/components/AccountShell";
import { LangProvider } from "@/components/LangProvider";

const buyer = (over: Record<string, unknown> = {}) => ({ id: "u1", email: "sam@example.com", name: "Sam", role: "buyer", avatarUrl: null, twoFactorEnabled: false, ...over });
function setAuth(user: Record<string, unknown> | null, over: Record<string, unknown> = {}) {
  m.auth.current = { user, isLoading: false, login: vi.fn(async () => ({ status: "ok" })), completeTwoFactor: vi.fn(async () => {}), signup: vi.fn(async () => {}), adoptSession: vi.fn(), refreshUser: vi.fn(async () => {}), logout: vi.fn(), ...over };
}
const auth = () => m.auth.current as Record<string, ReturnType<typeof vi.fn>>;
const show = (node: React.ReactNode, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}>{node}</LangProvider>);
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const tiers = [
  { id: "bronze", name: "Bronze", nameAr: "برونزي", color: "amber", icon: "award", discountPercentage: 0, spendThreshold: 0 },
  { id: "silver", name: "Silver", nameAr: "فضي", color: "blue", icon: "diamond", discountPercentage: 5, spendThreshold: 500 },
  { id: "gold", name: "Gold", nameAr: null, color: "purple", icon: "crown", discountPercentage: 10, spendThreshold: 2000 },
];
const loyalty = { currentTier: tiers[1], nextTier: tiers[2], progressPercent: 40, lifetimeSpend: 800, amountToNextTier: 1200, allTiers: tiers };

beforeEach(() => {
  vi.clearAllMocks();
  setAuth(buyer());
  m.params.current = new URLSearchParams(); m.path.current = "/account";
  m.api.fetchLoyaltyStatus.mockResolvedValue(loyalty); m.api.fetchMyGarage.mockResolvedValue([1, 2]); m.api.fetchMyOrders.mockResolvedValue([1, 2, 3]); m.api.fetchWishlist.mockResolvedValue([1]);
  m.api.fetchUnreadNotificationCount.mockResolvedValue(4); m.api.updateAvatar.mockResolvedValue({}); m.api.uploadReviewPhoto.mockResolvedValue("/uploads/me.jpg"); m.api.deleteAccount.mockResolvedValue(undefined);
  m.api.changeEmail.mockResolvedValue({ token: "new-tok", user: { id: "u1", email: "new@example.com", name: "Sam", role: "buyer" } });
  m.api.setupTwoFactor.mockResolvedValue({ secret: "JBSWY3DPEHPK3PXP", qrCodeDataUrl: "data:image/png;base64,AAAA" }); m.api.confirmTwoFactor.mockResolvedValue({}); m.api.disableTwoFactor.mockResolvedValue({}); m.api.forgotPassword.mockResolvedValue(undefined);
});

describe("login page", () => {
  const fill = () => { type("Email", "sam@example.com"); type("Password", "pw123456"); };
  it("CRITICAL: a password sign-in goes to the page the buyer came from, but ONLY a page on this site: another site's address is ignored", async () => {
    setAuth(null); m.params.current = new URLSearchParams("next=%2Fcheckout");
    const first = show(<LoginPage />);
    fill(); fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/checkout", undefined));
    expect(auth().login).toHaveBeenCalledWith("sam@example.com", "pw123456");
    first.unmount(); m.push.mockClear();
    setAuth(null); m.params.current = new URLSearchParams("next=https%3A%2F%2Fevil.example");
    show(<LoginPage />);
    fill(); fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/", undefined));
  });

  it("CRITICAL: an account with two-step sign-in is asked for the 6-digit code; a bad code is not sent; a good one signs in; Back returns to the password", async () => {
    setAuth(null, { login: vi.fn(async () => ({ status: "two_factor", userId: "u9" })) });
    show(<LoginPage />);
    fill(); fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter the 6-digit code from your authenticator app.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(m.push).not.toHaveBeenCalled();                                                                  // the password alone is not a sign-in
    type("6-digit code", "123");
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the 6-digit code");
    expect(auth().completeTwoFactor).not.toHaveBeenCalled();
    type("6-digit code", "123 456");
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(auth().completeTwoFactor).toHaveBeenCalledWith("u9", "123456"));
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/", undefined));
  });

  it("a wrong code or password shows the server's reason and keeps the form; Back from the code returns to the password", async () => {
    setAuth(null, { login: vi.fn(async () => { throw new Error("Invalid email or password"); }) });
    show(<LoginPage />);
    fill(); fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(m.push).not.toHaveBeenCalled();
    setAuth(null, { login: vi.fn(async () => ({ status: "two_factor", userId: "u9" })), completeTwoFactor: vi.fn(async () => { throw new Error("Incorrect authenticator code. Please try again."); }) });
  });

  it("offers forgot password and sign up (carrying the page to come back to), in Arabic too", () => {
    setAuth(null); m.params.current = new URLSearchParams("next=%2Fcheckout");
    show(<LoginPage />, "ar");
    expect(screen.getByRole("link", { name: "نسيت كلمة المرور؟" }).getAttribute("href")).toBe("/ar/forgot-password");
    expect(screen.getByRole("link", { name: "ليس لديك حساب؟ أنشئ حسابًا" }).getAttribute("href")).toBe("/ar/signup?next=%2Fcheckout");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("تسجيل الدخول");
  });
});

describe("sign-up page", () => {
  it("CRITICAL: needs a valid email and a password of 8 or more; sends the name and referral only when given; the guest's email from checkout is prefilled", async () => {
    setAuth(null); m.params.current = new URLSearchParams("email=guest%40example.com&ref=FRIEND1");
    show(<SignupPage />);
    expect(screen.getByLabelText("Email")).toHaveValue("guest@example.com");
    expect(screen.getByLabelText("Referral code (optional)")).toHaveValue("FRIEND1");
    type("Email", "not-an-email"); fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That doesn't look like a valid email address.");
    type("Email", "guest@example.com"); type("Password", "short");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Password must be at least 8 characters");
    expect(auth().signup).not.toHaveBeenCalled();
    type("Password", "longenough1"); type("Name (optional)", " Guest Buyer ");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(auth().signup).toHaveBeenCalledWith("guest@example.com", "longenough1", "FRIEND1", "Guest Buyer"));
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/", undefined));
  });
  it("a server refusal (the email is taken) is shown; in Arabic the page is Arabic", async () => {
    setAuth(null, { signup: vi.fn(async () => { throw new Error("An account with this email already exists"); }) });
    const first = show(<SignupPage />);
    type("Email", "taken@example.com"); type("Password", "longenough1");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists");
    first.unmount();
    show(<SignupPage />, "ar");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("إنشاء حساب");
    expect(screen.getByLabelText("الاسم (اختياري)")).toBeInTheDocument();
  });
});

describe("forgot password", () => {
  it("CRITICAL: asks for a valid email, then says 'if registered, a link was sent' (the SAME words whether or not the address has an account)", async () => {
    show(<ForgotPasswordPage />);
    type("Email", "nope"); fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid email");
    expect(m.api.forgotPassword).not.toHaveBeenCalled();
    type("Email", "sam@example.com"); fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("If that email is registered, a reset link has been sent.")).toBeInTheDocument();
    expect(m.api.forgotPassword).toHaveBeenCalledWith("sam@example.com");
    expect(screen.getByText(/opens a page where you choose a new password/)).toBeInTheDocument();
  });
  it("a failure is shown and the form stays", async () => {
    m.api.forgotPassword.mockRejectedValue(new Error("A valid email is required"));
    show(<ForgotPasswordPage />);
    type("Email", "sam@example.com"); fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A valid email is required");
  });
});

describe("account hub", () => {
  it("a visitor who is not signed in is invited to log in or sign up, and told they are browsing as a guest", () => {
    setAuth(null);
    show(<AccountPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You're browsing as a guest");
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login?next=%2Faccount");
    expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/signup?next=%2Faccount");
    expect(m.api.fetchMyOrders).not.toHaveBeenCalled();
  });

  it("CRITICAL: shows the buyer, their numbers (vehicles, orders, wishlist), the unread notifications and the loyalty card", async () => {
    show(<AccountPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sam");
    expect(await screen.findByText("3")).toBeInTheDocument();                                              // 3 orders
    expect(screen.getByText("Vehicles").previousElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Orders").previousElementSibling).toHaveTextContent("3");
    expect(screen.getByText("Wishlist").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: "Notifications (4)" }).getAttribute("href")).toBe("/notifications");
    expect(await screen.findByRole("heading", { name: "Silver Member" })).toBeInTheDocument();
    expect(screen.getByText("5% off every order")).toBeInTheDocument();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
  });

  it("the loyalty card is not shown for a buyer with no tier, and in Arabic it reads 'العضوية / فضي'", async () => {
    m.api.fetchLoyaltyStatus.mockResolvedValue({ ...loyalty, currentTier: null, nextTier: null });
    const first = show(<AccountPage />);
    await screen.findByText("3");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    first.unmount();
    m.api.fetchLoyaltyStatus.mockResolvedValue(loyalty);
    show(<AccountPage />, "ar");
    expect(await screen.findByRole("heading", { name: "العضوية / فضي" })).toBeInTheDocument();
  });

  it("CRITICAL: a new photo is uploaded, saved to the account, and the buyer is read again", async () => {
    show(<AccountPage />);
    await screen.findByText("3");
    fireEvent.change(screen.getByLabelText("Change photo", { selector: "input" }), { target: { files: [new File(["x"], "me.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(m.api.updateAvatar).toHaveBeenCalledWith("tok", "/uploads/me.jpg"));
    expect(m.api.uploadReviewPhoto).toHaveBeenCalledWith("tok", expect.any(File));
    await waitFor(() => expect(auth().refreshUser).toHaveBeenCalled());
  });

  it("a photo that fails to upload says so", async () => {
    m.api.uploadReviewPhoto.mockRejectedValue(new Error("down"));
    show(<AccountPage />);
    await screen.findByText("3");
    fireEvent.change(screen.getByLabelText("Change photo", { selector: "input" }), { target: { files: [new File(["x"], "me.jpg")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update your photo");
    expect(m.api.updateAvatar).not.toHaveBeenCalled();
  });

  it("CRITICAL: deleting the account is asked TWICE (whether, then the password), each step can be cancelled, and only the password step deletes", async () => {
    show(<AccountPage />);
    await screen.findByText("3");
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("alertdialog", { name: "Delete your account?" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete your account?" });          // the dialog is named for what it does; the field for what to type
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeDisabled();                        // nothing to send without a password
    expect(m.api.deleteAccount).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Confirm your password"), { target: { value: "pw123456" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.api.deleteAccount).toHaveBeenCalledWith("tok", "pw123456"));
    await waitFor(() => expect(auth().logout).toHaveBeenCalled());
    expect(m.push).toHaveBeenCalledWith("/", undefined);
  });

  it("a wrong password is shown, and the buyer is NOT signed out", async () => {
    m.api.deleteAccount.mockRejectedValue(new Error("Incorrect password"));
    show(<AccountPage />);
    await screen.findByText("3");
    fireEvent.click(screen.getByRole("button", { name: "Delete account" })); fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Confirm your password"), { target: { value: "wrong" } });
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password");
    expect(auth().logout).not.toHaveBeenCalled();
  });

  it("signing out signs out and goes home", async () => {
    show(<AccountPage />);
    await screen.findByText("3");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth().logout).toHaveBeenCalled();
    expect(m.push).toHaveBeenCalledWith("/", undefined);
  });
});

describe("the account menu", () => {
  it("shows the sections with the current one marked, in Arabic too; a visitor who is not signed in gets the page alone", () => {
    m.path.current = "/account/loyalty";
    const first = show(<AccountShell><p>content</p></AccountShell>);
    expect(screen.getByRole("link", { name: "My tier" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "My account" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(12);
    first.unmount();
    m.path.current = "/ar/account/change-email";
    show(<AccountShell><p>content</p></AccountShell>, "ar");
    expect(screen.getByRole("link", { name: "تغيير البريد الإلكتروني" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "عضويتي" }).getAttribute("href")).toBe("/ar/account/loyalty");
  });
  it("no menu without a sign-in", () => {
    setAuth(null);
    show(<AccountShell><p>only the page</p></AccountShell>);
    expect(screen.getByText("only the page")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

describe("loyalty page", () => {
  it("CRITICAL: shows where the buyer stands and EVERY tier with its discount and what unlocks it; the current one is marked", async () => {
    show(<LoyaltyPage />);
    expect(await screen.findByText("Silver Member")).toBeInTheDocument();
    expect(screen.getByText(/Lifetime spend:/)).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[1]).getByText("Silver — 5% off")).toBeInTheDocument();
    expect(items[1].getAttribute("aria-current")).toBe("true");
    expect(items[0].getAttribute("aria-current")).toBeNull();
    expect(within(items[2]).getByText(/Unlocked at/)).toBeInTheDocument();
  });
  it("in Arabic the tier names are Arabic where the server has them, and a status that cannot be loaded says so", async () => {
    const first = show(<LoyaltyPage />, "ar");
    expect(await screen.findByText("العضوية / فضي")).toBeInTheDocument();
    expect(screen.getByText("برونزي")).toBeInTheDocument();
    expect(screen.getByText("Gold — 10% خصم")).toBeInTheDocument();                                       // no Arabic name: the English one
    first.unmount();
    m.api.fetchLoyaltyStatus.mockRejectedValue(new Error("down"));
    show(<LoyaltyPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your loyalty status is not available right now.");
  });
});

describe("change email", () => {
  it("CRITICAL: needs both fields and a valid email; on success the NEW sign-in token is adopted so the buyer stays signed in", async () => {
    show(<ChangeEmailPage />);
    expect(screen.getByText("sam@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please fill in all fields.");
    type("New email", "bad"); type("Current password", "pw123456");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That doesn't look like a valid email address.");
    expect(m.api.changeEmail).not.toHaveBeenCalled();
    type("New email", " new@example.com ");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(m.api.changeEmail).toHaveBeenCalledWith("tok", "new@example.com", "pw123456"));
    await waitFor(() => expect(auth().adoptSession).toHaveBeenCalledWith("new-tok", expect.objectContaining({ id: "u1", email: "new@example.com", role: "buyer" })));
    expect(await screen.findByText("Your email has been updated.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toHaveValue("");                                    // the password is not left on the page
  });
  it("a refusal (wrong password, email taken) is shown and nothing changes", async () => {
    m.api.changeEmail.mockRejectedValue(new Error("Current password is incorrect"));
    show(<ChangeEmailPage />);
    type("New email", "new@example.com"); type("Current password", "wrong");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
    expect(auth().adoptSession).not.toHaveBeenCalled();
  });
});

describe("two-factor authentication", () => {
  it("CRITICAL: turning it on shows the QR code and the key, needs a 6-digit code, then confirms and reads the account again", async () => {
    show(<TwoFactorPage />);
    fireEvent.click(screen.getByRole("button", { name: "Turn on two-factor authentication" }));
    expect(await screen.findByAltText("QR code for your authenticator app")).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    type("Then enter the 6-digit code it shows:", "12345");
    fireEvent.click(screen.getByRole("button", { name: "Confirm and turn on" }));
    expect(screen.getByRole("alert")).toHaveTextContent("6-digit code");
    expect(m.api.confirmTwoFactor).not.toHaveBeenCalled();
    type("Then enter the 6-digit code it shows:", "123 456");
    fireEvent.click(screen.getByRole("button", { name: "Confirm and turn on" }));
    await waitFor(() => expect(m.api.confirmTwoFactor).toHaveBeenCalledWith("tok", "123456"));
    await waitFor(() => expect(auth().refreshUser).toHaveBeenCalled());
    expect(await screen.findByText("Two-factor authentication is now on.")).toBeInTheDocument();
  });
  it("a wrong code is refused with the server's reason and setup stays open", async () => {
    m.api.confirmTwoFactor.mockRejectedValue(new Error("Incorrect code. Please check your authenticator app and try again."));
    show(<TwoFactorPage />);
    fireEvent.click(screen.getByRole("button", { name: "Turn on two-factor authentication" }));
    await screen.findByAltText("QR code for your authenticator app");
    type("Then enter the 6-digit code it shows:", "000000");
    fireEvent.click(screen.getByRole("button", { name: "Confirm and turn on" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect code");
    expect(screen.getByAltText("QR code for your authenticator app")).toBeInTheDocument();
    expect(auth().refreshUser).not.toHaveBeenCalled();
  });
  it("CRITICAL: when it is on it says so, and turning it off needs the current password", async () => {
    setAuth(buyer({ twoFactorEnabled: true }));
    show(<TwoFactorPage />);
    expect(screen.getByText("Two-factor authentication is on.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on two-factor authentication" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn off two-factor authentication" })).toBeDisabled();     // no password yet
    type("Enter your current password to turn it off:", "pw123456");
    fireEvent.click(screen.getByRole("button", { name: "Turn off two-factor authentication" }));
    await waitFor(() => expect(m.api.disableTwoFactor).toHaveBeenCalledWith("tok", "pw123456"));
    await waitFor(() => expect(auth().refreshUser).toHaveBeenCalled());
    expect(await screen.findByText("Two-factor authentication is now off.")).toBeInTheDocument();
  });
  it("in Arabic it is the app's own Arabic", () => {
    show(<TwoFactorPage />, "ar");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("المصادقة الثنائية");
    expect(screen.getByRole("button", { name: "تفعيل المصادقة الثنائية" })).toBeInTheDocument();
  });
});

void act;
