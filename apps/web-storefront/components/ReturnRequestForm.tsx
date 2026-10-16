"use client";

import { useState } from "react";
import SafeImage from "@/components/SafeImage";
import Link from "@/components/LocLink";
import { createReturnCase, resolveImageUrl, uploadReviewPhoto, type OrderWho } from "@/lib/api";
import { useT } from "./LangProvider";

const MAX_PHOTOS = 3;
const input = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 py-2 text-[15px] text-ink";

/**
 * Ask to return one part of an order: a reason and the details (both required), and up to three photos as evidence (only a signed-in buyer can attach photos, like the app).
 * It goes to the Leap team, who coordinate with the supplier. The server refuses it once the return window after delivery has passed, and that reason is shown.
 */
export default function ReturnRequestForm({ subOrderId, who, onClose }: { subOrderId: number; who: OrderWho; onClose: () => void }) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const addPhoto = async (file: File | undefined) => {
    if (!file || !who.token || photos.length >= MAX_PHOTOS) return;
    setUploading(true); setError(null);
    try { setPhotos((p) => [...p, ""]); const url = await uploadReviewPhoto(who.token, file); setPhotos((p) => [...p.slice(0, -1), url]); }
    catch (e) { setPhotos((p) => p.slice(0, -1)); setError(e instanceof Error && e.message ? e.message : t("photo_upload_failed")); }
    finally { setUploading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !message.trim()) return setError(t("please_fill_both_fields"));
    setBusy(true); setError(null);
    try {
      const made = await createReturnCase({ subOrderId, reason: reason.trim(), message: message.trim(), photos: photos.filter(Boolean) }, who);
      setSent(made.id);
    } catch (err) { setError(err instanceof Error && err.message ? err.message : t("something_went_wrong")); }
    finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div role="status" className="mt-3 rounded-xl bg-[#e8f4ee] p-4 text-sm font-semibold text-[#0f6b49]">
        {t("return_sent")}{" "}
        <Link href={`/returns/${encodeURIComponent(sent)}${!who.token && who.guestEmail ? `?guestEmail=${encodeURIComponent(who.guestEmail)}` : ""}`} className="font-bold underline underline-offset-4">{t("view_return")}</Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="mt-3 grid gap-3 rounded-xl border border-line bg-[#f8fafb] p-4" aria-label={t("request_a_return")}>
      <p className="text-sm text-muted">{t("return_goes_to_team")}</p>
      <div>
        <label htmlFor={`rr-reason-${subOrderId}`} className="mb-1.5 block text-[13px] font-bold text-navy">{t("return_reason_label")}</label>
        <input id={`rr-reason-${subOrderId}`} className={input} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
      </div>
      <div>
        <label htmlFor={`rr-details-${subOrderId}`} className="mb-1.5 block text-[13px] font-bold text-navy">{t("details_label")}</label>
        <textarea id={`rr-details-${subOrderId}`} rows={4} className={input} value={message} onChange={(e) => setMessage(e.target.value)} disabled={busy} />
      </div>
      {who.token ? (
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-navy">{t("attach_photos_optional")}</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((url, i) => (
              <div key={i} className="relative size-20 overflow-hidden rounded-lg bg-[#e6edf2]">
                {url && <SafeImage src={resolveImageUrl(url)} alt="" fill sizes="80px" className="object-cover" unoptimized />}
                {url && <button type="button" aria-label={t("remove_photo")} onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-xs font-bold text-white">×</button>}
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="grid size-20 cursor-pointer place-items-center rounded-lg border-[1.5px] border-dashed border-[#c5d0d8] bg-white text-2xl text-navy">
                <span aria-hidden="true">{uploading ? "…" : "+"}</span>
                <input type="file" accept="image/*" className="sr-only" aria-label={t("attach_photos_optional")} disabled={uploading || busy} onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">{t("photos_need_login")}</p>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || uploading} className="inline-flex min-h-11 items-center rounded-[10px] bg-signal px-5 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-50">{busy ? t("saving") : t("submit_request")}</button>
        <button type="button" onClick={onClose} disabled={busy} className="inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-5 font-bold text-navy hover:bg-chalk disabled:opacity-50">{t("cancel")}</button>
      </div>
    </form>
  );
}
