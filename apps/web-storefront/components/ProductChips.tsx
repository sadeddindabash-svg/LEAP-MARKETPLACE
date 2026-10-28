import SafeImage from "@/components/SafeImage";
import { resolveImageUrl, type ProductDetail } from "@/lib/api";
import { fitChipText } from "@/lib/fitGroups";
import { fitBrandLogos } from "@/lib/fitLogos";
import type { Lang } from "@/lib/i18n";

/**
 * The two chips under the product name: the part class WITH the part's photo beside it, and what the part fits WITH the logos of its brands in front ("FITS BYD Seal 2022–2024 +4 more models").
 * No part photo (not every part class has one) and no logo (not every brand has one) simply leave the chip as it was.
 */
export default function ProductChips({ product, lang }: { product: ProductDetail; lang: Lang }) {
  const fit = fitChipText(lang, product);
  const { shown, extra } = fitBrandLogos(product, lang);
  const photo = product.partPhotoUrl || null;
  return (
    <>
      {product.part && (
        <span data-testid="part-chip" className={`plate-chip gap-2 ${photo ? "!py-1 !ps-1" : ""}`}>
          {photo && (
            <span data-testid="part-photo" className="relative block size-[30px] shrink-0 overflow-hidden rounded-md border border-line bg-white">
              <SafeImage src={resolveImageUrl(photo)} alt="" fill sizes="30px" className="object-contain" unoptimized />
            </span>
          )}
          {product.part}
        </span>
      )}
      {fit && (
        <span data-testid="fit-chip" className={`plate-chip gap-2 ${shown.length > 0 ? "!py-1 !ps-1.5" : ""}`}>
          {shown.length > 0 && (
            <span data-testid="fit-logos" className="flex shrink-0 items-center">
              {shown.map((l, i) => (
                <span key={l.url} data-testid="fit-logo" className={`relative block size-7 overflow-hidden rounded-full border-2 border-white bg-white shadow-[0_0_0_1px_#d7e0e6] ${i > 0 ? "-ms-2" : ""}`}>
                  <SafeImage src={resolveImageUrl(l.url)} alt={l.name} fill sizes="28px" className="object-contain" unoptimized />
                </span>
              ))}
              {extra > 0 && <span data-testid="fit-logos-more" className="-ms-2 grid size-7 place-items-center rounded-full border-2 border-white bg-[#e6edf2] text-[11px] font-bold text-navy shadow-[0_0_0_1px_#d7e0e6]">+{extra}</span>}
            </span>
          )}
          {fit}
        </span>
      )}
    </>
  );
}
