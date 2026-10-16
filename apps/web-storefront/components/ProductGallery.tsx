"use client";

import { useState } from "react";
import SafeImage from "@/components/SafeImage";
import { useLang, useT } from "./LangProvider";

/** The photos of a part: one large, arrows to go through them, a thumbnail for each, and the arrow keys. Nothing is swapped to a placeholder unless there are no photos at all. */
export default function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const t = useT();
  const lang = useLang();
  const [index, setIndex] = useState(0);
  const count = images.length;
  const go = (to: number) => setIndex(((to % count) + count) % count);

  if (count === 0) {
    return <div className="grid aspect-square place-items-center rounded-lg border border-line bg-white text-muted">{t("no_photo")}</div>;
  }
  const status = t("photo_n_of_m", { n: index + 1, total: count });
  // The arrow keys follow the reading direction: in Arabic the right arrow goes back.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const forward = lang === "ar" ? "ArrowLeft" : "ArrowRight";
    const back = lang === "ar" ? "ArrowRight" : "ArrowLeft";
    if (e.key === forward) { e.preventDefault(); go(index + 1); }
    if (e.key === back) { e.preventDefault(); go(index - 1); }
  };

  return (
    <div role="group" aria-roledescription="carousel" aria-label={alt} onKeyDown={onKeyDown}>
      <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-white">
        <SafeImage src={images[index]} alt={`${alt} (${status})`} fill sizes="(min-width: 768px) 50vw, 100vw" priority={index === 0} className="object-cover" unoptimized />
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label={t("previous_photo")} className="absolute start-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy shadow hover:bg-white">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label={t("next_photo")} className="absolute end-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy shadow hover:bg-white">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </>
        )}
      </div>
      <p aria-live="polite" className="sr-only">{status}</p>
      {count > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2">
          {images.slice(0, 10).map((url, i) => (
            <li key={url}>
              <button type="button" onClick={() => setIndex(i)} aria-label={t("photo_n_of_m", { n: i + 1, total: count })} aria-current={i === index ? "true" : undefined}
                className={`relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-white ${i === index ? "border-navy" : "border-line"}`}>
                <SafeImage src={url} alt="" fill sizes="96px" className="object-cover" unoptimized />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
