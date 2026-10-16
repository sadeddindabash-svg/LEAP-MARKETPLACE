import { resolveImageUrl, type ReviewsSummary } from "@/lib/api";
import SafeImage from "@/components/SafeImage";
import { customerPhotos } from "@/lib/review";
import { t, type Lang } from "@/lib/i18n";

/** "Customer photos": the photos buyers added to their reviews, newest first. Nothing is drawn when there are none. */
export default function CustomerPhotos({ reviews, lang }: { reviews: ReviewsSummary["reviews"]; lang: Lang }) {
  const photos = customerPhotos(reviews);
  if (photos.length === 0) return null;
  return (
    <section className="mt-14" aria-labelledby="cp-h">
      <h2 id="cp-h" className="mb-5 text-2xl font-bold tracking-tight">{t(lang, "customer_photos")}</h2>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {photos.map((url) => (
          <li key={url}>
            <a href={resolveImageUrl(url)} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-xl border border-line bg-white">
              <SafeImage src={resolveImageUrl(url)} alt={t(lang, "customer_photos")} fill sizes="(min-width: 1024px) 16vw, 25vw" className="object-cover" unoptimized />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
