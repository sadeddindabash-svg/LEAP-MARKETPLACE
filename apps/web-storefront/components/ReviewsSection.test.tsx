import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { MyReview, ReviewsSummary } from "@/lib/api";

// Writing, editing, photos and reporting a review, with the server and the sign-in state replaced by fixed values.
const m = vi.hoisted(() => ({
  auth: { current: { user: null as { id: string } | null } },
  fetchMyReviews: vi.fn(),
  submitReview: vi.fn(),
  uploadReviewPhoto: vi.fn(),
  flagReview: vi.fn(),
}));
vi.mock("./AuthProvider", () => ({ useAuth: () => m.auth.current, getAuthToken: () => "tok" }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    fetchMyReviews: (...a: unknown[]) => m.fetchMyReviews(...a),
    submitReview: (...a: unknown[]) => m.submitReview(...a),
    uploadReviewPhoto: (...a: unknown[]) => m.uploadReviewPhoto(...a),
    flagReview: (...a: unknown[]) => m.flagReview(...a),
    resolveImageUrl: (u: string) => u,
  };
});

import ReviewsSection from "./ReviewsSection";
import { LangProvider } from "./LangProvider";
import { ApiError } from "@/lib/api";

const review = (id: number, over: Partial<ReviewsSummary["reviews"][number]> = {}): ReviewsSummary["reviews"][number] => ({ id, buyerName: `Buyer ${id}`, rating: 5, comment: `Comment ${id}`, createdAt: "2026-01-01", photos: [], isVerifiedPurchase: true, ...over });
const summary = (n: number, over: Partial<ReviewsSummary> = {}): ReviewsSummary => ({ averageRating: 4.4, reviewCount: n, reviews: Array.from({ length: n }, (_, i) => review(i + 1)), ...over });
const mine = (over: Partial<MyReview> = {}): MyReview => ({ id: 99, productId: "p1", rating: 2, comment: "Old", status: "pending", photos: [], isVerifiedPurchase: true, createdAt: "2026-01-01", updatedAt: "2026-01-01", ...over });
const show = (s: ReviewsSummary, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><ReviewsSection productId="p1" summary={s} /></LangProvider>);
const signIn = () => { m.auth.current = { user: { id: "u1" } }; };
const photoFile = (name = "a.jpg", type = "image/jpeg") => new File(["x"], name, { type });
const addPhoto = async (file: File) => { await act(async () => { fireEvent.change(screen.getByLabelText(/Add photos/), { target: { files: [file] } }); }); };
const chooseStars = (n: number) => fireEvent.click(screen.getByRole("radio", { name: `Rate ${n} out of 5` }));

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.current = { user: null };
  m.fetchMyReviews.mockResolvedValue([]);
  m.submitReview.mockResolvedValue({});
  let n = 0;
  m.uploadReviewPhoto.mockImplementation(async () => `/uploads/photo-${++n}.jpg`);
  m.flagReview.mockResolvedValue(undefined);
});

describe("the list of reviews", () => {
  it("CRITICAL: shows the average and the count, three reviews at a time, and 'Show more' reveals the rest", () => {
    show(summary(5));
    expect(screen.getByRole("heading", { name: /Reviews/ })).toHaveTextContent("4.4 average · 5 reviews");
    expect(screen.getAllByText(/^Comment \d$/)).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more reviews" }));
    expect(screen.getAllByText(/^Comment \d$/)).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /Show \d more reviews/ })).not.toBeInTheDocument();
  });

  it("shows who wrote it (or 'Buyer'), whether it is a verified purchase, and the photos; one review says '1 review'", () => {
    show(summary(1, { reviewCount: 1, averageRating: 5, reviews: [review(1, { buyerName: null, isVerifiedPurchase: false }), ] }));
    expect(screen.getByRole("heading", { name: /Reviews/ })).toHaveTextContent("5.0 average · 1 review");
    expect(screen.getByText("Buyer")).toBeInTheDocument();
    expect(screen.queryByText("✓ Verified Purchase")).not.toBeInTheDocument();
  });

  it("with no reviews it says so", () => {
    show({ averageRating: null, reviewCount: 0, reviews: [] });
    expect(screen.getByText("No reviews yet for this part.")).toBeInTheDocument();
  });

  it("CRITICAL: a visitor is invited to sign in to write one, and cannot report anything", () => {
    show(summary(2));
    expect(screen.getByRole("link", { name: "Log in to write a review." }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
    expect(m.fetchMyReviews).not.toHaveBeenCalled();
  });

  it("in Arabic the headings and buttons are the app's Arabic", () => {
    show(summary(5), "ar");
    expect(screen.getByRole("heading", { name: /التقييمات/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "عرض 2 تقييمات أخرى" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "سجّل الدخول لكتابة تقييم." }).getAttribute("href")).toBe("/ar/login");
  });
});

describe("writing a review", () => {
  it("CRITICAL: a rating is required (nothing can be sent without one), and the review is sent with its comment, then shows as awaiting review", async () => {
    signIn();
    m.fetchMyReviews.mockResolvedValueOnce([]).mockResolvedValue([mine({ rating: 4, comment: "Fits well", status: "pending" })]);
    show(summary(0, { averageRating: null, reviews: [] }));
    fireEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    chooseStars(4);
    fireEvent.change(screen.getByPlaceholderText("Add a comment (optional)"), { target: { value: "  Fits well  " } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit" })); });
    expect(m.submitReview).toHaveBeenCalledWith("tok", { productId: "p1", rating: 4, comment: "Fits well", photos: [] });
    expect(await screen.findByText("Your review is awaiting review.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Add a comment (optional)")).not.toBeInTheDocument();       // the form closed
  });

  it("the comment is optional: a rating alone is sent with no comment", async () => {
    signIn();
    show(summary(0, { averageRating: null, reviews: [] }));
    fireEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    chooseStars(5);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit" })); });
    expect(m.submitReview).toHaveBeenCalledWith("tok", { productId: "p1", rating: 5, comment: undefined, photos: [] });
  });

  it("CRITICAL: a review the server refuses for want of a purchase gets that explanation; any other failure the generic one; the form stays open with what was typed", async () => {
    signIn();
    show(summary(0, { averageRating: null, reviews: [] }));
    fireEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    chooseStars(3);
    fireEvent.change(screen.getByPlaceholderText("Add a comment (optional)"), { target: { value: "Typed text" } });
    m.submitReview.mockRejectedValueOnce(new ApiError("Only buyers who have received this product can leave a review.", "review_requires_purchase", 403));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit" })); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Only buyers who have received this product can leave a review.");
    m.submitReview.mockRejectedValueOnce(new Error("boom"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit" })); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect(screen.getByPlaceholderText("Add a comment (optional)")).toHaveValue("Typed text");
  });
});

describe("review photos", () => {
  const openForm = async () => { signIn(); show(summary(0, { averageRating: null, reviews: [] })); fireEvent.click(await screen.findByRole("button", { name: "Write a review" })); };

  it("CRITICAL: up to three photos are uploaded and sent with the review; at three the add control goes, and removing one brings it back", async () => {
    await openForm();
    await addPhoto(photoFile("1.jpg")); await addPhoto(photoFile("2.jpg")); await addPhoto(photoFile("3.jpg"));
    expect(m.uploadReviewPhoto).toHaveBeenCalledTimes(3);
    expect(screen.queryByLabelText(/Add photos/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Remove photo" })[1]);
    expect(screen.getByLabelText(/Add photos/)).toBeInTheDocument();
    chooseStars(5);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit" })); });
    expect(m.submitReview).toHaveBeenCalledWith("tok", expect.objectContaining({ photos: ["/uploads/photo-1.jpg", "/uploads/photo-3.jpg"] }));
  });

  it("something that is not an image is never uploaded; a failed upload is a plain message and nothing is added", async () => {
    await openForm();
    await addPhoto(photoFile("doc.pdf", "application/pdf"));
    expect(m.uploadReviewPhoto).not.toHaveBeenCalled();
    m.uploadReviewPhoto.mockRejectedValueOnce(new Error("too big"));
    await addPhoto(photoFile("big.jpg"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not upload the photo. Please try again.");
    expect(screen.queryAllByRole("button", { name: "Remove photo" })).toHaveLength(0);
  });
});

describe("editing and the state of my review", () => {
  it("CRITICAL: a review that was not approved says so and can be edited, with the old rating, comment and photos filled in", async () => {
    signIn();
    m.fetchMyReviews.mockResolvedValue([mine({ status: "rejected", rating: 2, comment: "Old", photos: ["/uploads/x.jpg"] }), mine({ id: 5, productId: "other", status: "approved" })]);
    show(summary(1));
    expect(await screen.findByText("Your review was not approved.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit your review" }));
    expect(screen.getByRole("heading", { name: "Edit your review" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add a comment (optional)")).toHaveValue("Old");
    expect(screen.getByRole("radio", { name: "Rate 2 out of 5" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("button", { name: "Remove photo" })).toHaveLength(1);
  });

  it("another part's review is not mine here (only THIS part's counts)", async () => {
    signIn();
    m.fetchMyReviews.mockResolvedValue([mine({ productId: "other", status: "rejected" })]);
    show(summary(1));
    expect(await screen.findByRole("button", { name: "Write a review" })).toBeInTheDocument();
    expect(screen.queryByText("Your review was not approved.")).not.toBeInTheDocument();
  });

  it("Cancel closes the form without sending anything", async () => {
    signIn();
    show(summary(1));
    fireEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Add a comment (optional)")).not.toBeInTheDocument();
    expect(m.submitReview).not.toHaveBeenCalled();
  });
});

describe("reporting a review", () => {
  it("CRITICAL: a reason is required, then the report goes to the moderators and is confirmed; a failure is a plain message", async () => {
    signIn();
    show(summary(2));
    fireEvent.click(screen.getAllByRole("button", { name: "Report" })[0]);
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Why are you reporting this?"), { target: { value: "  Spam  " } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit" })); });
    expect(m.flagReview).toHaveBeenCalledWith("tok", 1, "Spam");
    expect(await screen.findByText("Your report was submitted.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Report" })[1]);
    m.flagReview.mockRejectedValueOnce(new Error("no"));
    fireEvent.change(screen.getByPlaceholderText("Why are you reporting this?"), { target: { value: "Rude" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit" })); });
    await waitFor(() => expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument());
  });

  it("only one report form is open at a time, and Cancel closes it", () => {
    signIn();
    show(summary(2));
    fireEvent.click(screen.getAllByRole("button", { name: "Report" })[0]);
    expect(screen.getAllByPlaceholderText("Why are you reporting this?")).toHaveLength(1);
    const form = screen.getByPlaceholderText("Why are you reporting this?").closest("form") as HTMLElement;
    fireEvent.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Why are you reporting this?")).not.toBeInTheDocument();
  });
});
