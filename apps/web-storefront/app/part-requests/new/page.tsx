"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "@/components/LocLink";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useGarage } from "@/components/GarageProvider";
import { useLang, useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";
import VehicleCascade, { type VehicleChoice } from "@/components/VehicleCascade";
import { addQuoteRequestItem, createQuoteRequest, deleteQuoteRequestItem, fetchQuoteRequest, resolveImageUrl, submitQuoteRequest, uploadReviewPhoto, type QuoteRequest } from "@/lib/api";
import { vehicleLabel } from "@/lib/garage";
import { MAX_QUOTE_ITEMS, canAddItems } from "@/lib/quotes";

const input = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 py-2 text-[15px] text-ink";
const primary = "inline-flex min-h-12 items-center justify-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-50";
const outline = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50";

// Request a quote, like the app: pick the car, list the parts you need (up to 20, each with an optional description and photo), then send it. The Leap team makes the parts and
// sends a quote. A request left half-way is a draft and can be continued from My requests (?draft=...).
function NewRequest() {
  const { user, isLoading } = useAuth();
  const { defaultVehicle } = useGarage();
  const lang = useLang();
  const t = useT();
  const router = useLocRouter();
  const draftId = useSearchParams().get("draft");
  const [request, setRequest] = useState<QuoteRequest | null>(null);
  const [picked, setPicked] = useState<VehicleChoice | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !draftId) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchQuoteRequest(token, draftId).then((r) => { if (current) setRequest(r); }).catch((e) => { if (current) setError(e instanceof Error ? e.message : t("something_went_wrong")); });
    return () => { current = false; };
  }, [user, draftId, t]);

  const run = async (work: (token: string) => Promise<void>) => {
    const token = getAuthToken();
    if (!token) return;
    setBusy(true); setError(null);
    try { await work(token); } catch (e) { setError(e instanceof Error && e.message ? e.message : t("something_went_wrong")); } finally { setBusy(false); }
  };

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!user) return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8"><p className="mb-4 text-lg text-muted">{t("quote_login_needed")}</p><Link href="/login?next=%2Fpart-requests%2Fnew" className={primary}>{t("log_in")}</Link></div>;

  const start = (car: { generationId: string; year: number }) => run(async (token) => setRequest(await createQuoteRequest(token, car.generationId, car.year)));
  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !name.trim()) return;
    return run(async (token) => {
      setRequest(await addQuoteRequestItem(token, request.id, { name: name.trim(), description: description.trim() || null, referencePhotoUrl: photo, quantity }));
      setName(""); setDescription(""); setQuantity(1); setPhoto(null);
    });
  };
  const attach = (file: File | undefined) => file && run(async (token) => setPhoto(await uploadReviewPhoto(token, file)));
  const send = () => {
    if (!request) return;
    if (request.items.length === 0) return setError(t("add_at_least_one_item"));
    return run(async (token) => { await submitQuoteRequest(token, request.id); router.push("/part-requests"); });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-navy">{t("quote_request_title")}</h1>
      {error && <p role="alert" className="mb-4 text-sm font-semibold text-[#a12a21]">{error}</p>}

      {!request ? (
        draftId ? <p className="text-muted" aria-busy="true">{t("search_loading")}</p> : (
          <section className="rounded-[14px] border border-line bg-white p-6" aria-labelledby="qr-car">
            <h2 id="qr-car" className="mb-3 text-xl font-bold">{t("wizard_which_car")}</h2>
            {defaultVehicle && <button type="button" className={`${outline} mb-4`} disabled={busy} onClick={() => start(defaultVehicle)}>{t("wizard_use_garage", { car: vehicleLabel(lang, defaultVehicle) })}</button>}
            <p className="mb-2 text-sm text-muted">{t("wizard_or_pick")}</p>
            <VehicleCascade idPrefix="qr" onChange={setPicked} />
            <button type="button" className={`${primary} mt-5`} disabled={!picked || busy} onClick={() => picked && start(picked)}>{t("start_request")}</button>
          </section>
        )
      ) : !canAddItems(request) ? (
        <p className="text-muted">{t("request_draft_note")} <Link href={`/part-requests/${encodeURIComponent(request.id)}`} className="font-bold text-navy underline underline-offset-4">{t("my_requests_title")}</Link></p>
      ) : (
        <div className="grid gap-6">
          <p className="font-semibold text-muted">{t("request_for_car", { car: [request.brand, request.model].filter(Boolean).join(" ") + ` · ${request.year}` })}</p>
          <section aria-labelledby="qr-items" className="rounded-[14px] border border-line bg-white p-6">
            <h2 id="qr-items" className="mb-3 text-xl font-bold">{t("quote_step_items")}</h2>
            {request.items.length === 0 ? <p className="text-sm text-muted">{t("add_at_least_one_item")}</p> : (
              <ul className="grid gap-3">
                {request.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <span className="relative size-14 flex-none overflow-hidden rounded-lg bg-[#e6edf2]">{item.referencePhotoUrl && <Image src={resolveImageUrl(item.referencePhotoUrl)} alt="" fill sizes="56px" className="object-cover" unoptimized />}</span>
                    <div className="min-w-0 flex-1"><p className="font-bold">{item.name}</p>{item.description && <p className="truncate text-sm text-muted">{item.description}</p>}<p className="text-xs text-muted">{t("qty_label", { n: item.quantity })}</p></div>
                    <button type="button" disabled={busy} aria-label={`${t("remove")}: ${item.name}`} onClick={() => run(async (token) => setRequest(await deleteQuoteRequestItem(token, request.id, item.id)))} className="grid size-9 place-items-center rounded-full text-lg font-bold text-[#a12a21] hover:bg-[#fdf2f1]">×</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <form onSubmit={addItem} noValidate className="grid gap-3 rounded-[14px] border border-line bg-white p-6" aria-label={t("add_item")}>
            <div><label htmlFor="qi-name" className="mb-1.5 block text-[13px] font-bold text-navy">{t("part_name")}</label><input id="qi-name" className={input} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label htmlFor="qi-desc" className="mb-1.5 block text-[13px] font-bold text-navy">{t("description_optional")}</label><textarea id="qi-desc" rows={3} className={input} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="flex flex-wrap items-end gap-4">
              <div><label htmlFor="qi-qty" className="mb-1.5 block text-[13px] font-bold text-navy">{t("quantity_field")}</label><input id="qi-qty" type="number" min={1} max={999} className={`${input} w-28`} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} /></div>
              <div>
                <span className="mb-1.5 block text-[13px] font-bold text-navy">{t("reference_photo")}</span>
                {photo ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0f6b49]">✓ <button type="button" className="underline" onClick={() => setPhoto(null)}>{t("remove_photo")}</button></span> : (
                  <label className={`${outline} cursor-pointer`}>{t("attach_photos_optional")}<input type="file" accept="image/*" className="sr-only" aria-label={t("reference_photo")} disabled={busy} onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} /></label>
                )}
              </div>
            </div>
            <button type="submit" disabled={!name.trim() || busy || request.items.length >= MAX_QUOTE_ITEMS} className={`${primary} justify-self-start`}>{t("add_item_count", { n: request.items.length, max: MAX_QUOTE_ITEMS })}</button>
          </form>
          <button type="button" className={primary} disabled={request.items.length === 0 || busy} onClick={send}>{busy ? t("submitting") : t("submit_request")}</button>
        </div>
      )}
    </div>
  );
}

export default function NewRequestPage() {
  return <Suspense fallback={null}><NewRequest /></Suspense>;
}
