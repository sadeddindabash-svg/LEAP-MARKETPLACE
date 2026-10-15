"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "@/components/LocLink";
import { ApiError, fetchMyReviews, flagReview, resolveImageUrl, submitReview, uploadReviewPhoto, type MyReview, type ReviewsSummary } from "@/lib/api";
import { MAX_REVIEW_PHOTOS, REVIEW_BATCH, canAddPhoto, myReviewOf, reviewErrorKey, reviewState, wholeStars } from "@/lib/review";
import { getAuthToken, useAuth } from "./AuthProvider";
import { useT } from "./LangProvider";

const button = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50";
const primary = "inline-flex min-h-12 items-center justify-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-50";

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span role="img" aria-label={`${value} / 5`} className="inline-flex gap-0.5 text-[#f2a100]">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={i <= value ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
      ))}
    </span>
  );
}

/**
 * The reviews of a part, with the rules of the mobile app and the server: shown three at a time; a signed-in buyer who received the part can write ONE review (writing again edits
 * it, and it goes back to a moderator), with a star rating, an optional comment and up to three photos; anyone signed in can report a review. The list arrives from the server
 * (so it is in the page's HTML); only the buyer's own review is fetched here.
 */
export default function ReviewsSection({ productId, summary }: { productId: string; summary: ReviewsSummary }) {
  const { user } = useAuth();
  const t = useT();
  const userId = user?.id ?? null;
  const [visible, setVisible] = useState(REVIEW_BATCH);
  const [loaded, setLoaded] = useState<{ userId: string; review: MyReview | null } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const [reporting, setReporting] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [reportNote, setReportNote] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchMyReviews(token).then((list) => { if (current) setLoaded({ userId, review: myReviewOf(productId, list) }); }).catch(() => { if (current) setLoaded({ userId, review: null }); });
    return () => { current = false; };
  }, [userId, productId]);

  const mine = userId && loaded?.userId === userId ? loaded.review : null;
  const state = reviewState(mine);

  const openForm = () => { setRating(mine?.rating ?? 0); setComment(mine?.comment ?? ""); setPhotos(mine?.photos ?? []); setError(null); setThanks(false); setFormOpen(true); };

  const addPhoto = async (file: File | undefined) => {
    const token = getAuthToken();
    if (!file || !token || !canAddPhoto(photos.length, file)) return;
    setUploading(true); setError(null);
    try { const url = await uploadReviewPhoto(token, file); setPhotos((cur) => [...cur, url]); } catch { setError(t("photo_upload_failed")); } finally { setUploading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token || !userId || rating < 1) return;
    setSubmitting(true); setError(null);
    try {
      await submitReview(token, { productId, rating, comment: comment.trim() || undefined, photos });
      setLoaded({ userId, review: myReviewOf(productId, await fetchMyReviews(token)) });
      setFormOpen(false); setThanks(true);
    } catch (err) {
      setError(t(err instanceof ApiError ? reviewErrorKey(err.code) : "generic_error"));
    } finally { setSubmitting(false); }
  };

  const sendReport = async (reviewId: number) => {
    const token = getAuthToken();
    if (!token || !reason.trim()) return;
    try { await flagReview(token, reviewId, reason.trim()); setReportNote(t("report_sent")); setReporting(null); setReason(""); } catch { setReportNote(t("generic_error")); }
  };

  const shown = summary.reviews.slice(0, visible);
  return (
    <section className="mt-16 border-t border-line pt-10" aria-labelledby="rv-h">
      <h2 id="rv-h" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xl font-bold tracking-tight">
        {t("reviews_heading")}
        {summary.reviewCount > 0 && (
          <span className="flex items-center gap-2 text-base font-normal text-muted">
            <Stars value={wholeStars(summary.averageRating)} size={18} />
            {t(summary.reviewCount === 1 ? "reviews_summary_one" : "reviews_summary_many", { avg: summary.averageRating?.toFixed(1) ?? "", n: summary.reviewCount })}
          </span>
        )}
      </h2>

      {summary.reviews.length === 0 ? (
        <p className="text-muted">{t("no_reviews_yet")}</p>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {shown.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} size={15} />
                <span className="text-sm font-semibold">{r.buyerName || t("buyer")}</span>
                {r.isVerifiedPurchase && <span className="text-xs font-bold text-[#0f6b49]">{t("verified_purchase")}</span>}
              </div>
              {r.comment && <p className="mt-2 text-[15px] leading-relaxed">{r.comment}</p>}
              {r.photos.length > 0 && (
                <ul className="mt-3 flex gap-2">
                  {r.photos.map((url) => (
                    <li key={url}><a href={resolveImageUrl(url)} target="_blank" rel="noopener noreferrer" className="relative block size-16 overflow-hidden rounded-lg border border-line"><Image src={resolveImageUrl(url)} alt={t("customer_photos")} fill sizes="64px" className="object-cover" unoptimized /></a></li>
                  ))}
                </ul>
              )}
              {userId && (
                <div className="mt-3">
                  {reporting === r.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); sendReport(r.id); }} className="grid gap-2">
                      <label htmlFor={`report-${r.id}`} className="text-sm font-bold">{t("report_title")}</label>
                      <textarea id={`report-${r.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("report_reason")} rows={2} className="rounded-lg border-[1.5px] border-[#c5d0d8] p-2 text-sm" />
                      <div className="flex gap-2">
                        <button type="submit" className={button} disabled={!reason.trim()}>{t("review_submit")}</button>
                        <button type="button" className={button} onClick={() => { setReporting(null); setReason(""); }}>{t("cancel")}</button>
                      </div>
                    </form>
                  ) : (
                    <button type="button" className="min-h-11 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink" onClick={() => { setReporting(r.id); setReportNote(null); }}>{t("report")}</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-3 text-sm font-semibold text-navy">{reportNote}</p>
      {summary.reviews.length > visible && (
        <div className="mt-5"><button type="button" className={button} onClick={() => setVisible((v) => v + REVIEW_BATCH)}>{t("show_more_reviews", { n: Math.min(REVIEW_BATCH, summary.reviews.length - visible) })}</button></div>
      )}

      <div className="mt-10 rounded-[14px] border border-line bg-white p-6">
        {!userId ? (
          <Link href="/login" className="font-bold text-navy underline underline-offset-4">{t("login_to_review")}</Link>
        ) : formOpen ? (
          <form onSubmit={submit} className="grid gap-4">
            <h3 className="text-lg font-bold">{mine ? t("edit_review") : t("write_review")}</h3>
            <div role="radiogroup" aria-label={t("your_rating")} className="flex gap-1 text-[#f2a100]">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={t("rate_n_stars", { n: i })} onClick={() => setRating(i)} className="grid size-11 place-items-center rounded-lg hover:bg-chalk">
                  <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill={i <= rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="rv-comment" className="sr-only">{t("review_comment_hint")}</label>
              <textarea id="rv-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("review_comment_hint")} rows={3} className="w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] p-3 text-[15px]" />
            </div>
            <div>
              <ul className="mb-3 flex flex-wrap gap-2">
                {photos.map((url) => (
                  <li key={url} className="relative size-20 overflow-hidden rounded-lg border border-line">
                    <Image src={resolveImageUrl(url)} alt="" fill sizes="80px" className="object-cover" unoptimized />
                    <button type="button" aria-label={t("remove_photo")} onClick={() => setPhotos((cur) => cur.filter((p) => p !== url))} className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-white/90 text-xs font-bold text-[#a12a21]">×</button>
                  </li>
                ))}
              </ul>
              {photos.length < MAX_REVIEW_PHOTOS && (
                <label className={`${button} cursor-pointer`}>
                  {uploading ? t("search_loading") : t("add_photos")}
                  <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              )}
              <span className="ms-3 text-sm text-muted">{t("photos_up_to", { n: MAX_REVIEW_PHOTOS })}</span>
            </div>
            {error && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="submit" className={primary} disabled={rating < 1 || submitting || uploading}>{submitting ? t("saving") : t("review_submit")}</button>
              <button type="button" className={button} onClick={() => setFormOpen(false)}>{t("cancel")}</button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            {state === "pending" && <p className="font-semibold text-navy">{t("review_pending")}</p>}
            {state === "rejected" && <p className="font-semibold text-[#a12a21]">{t("review_rejected")}</p>}
            {thanks && state === "none" && <p role="status" className="font-semibold text-[#0f6b49]">{t("review_thanks")}</p>}
            <button type="button" className={button} onClick={openForm}>{mine ? t("edit_review") : t("write_review")}</button>
            {error && <p role="alert" className="w-full text-sm font-semibold text-[#a12a21]">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
