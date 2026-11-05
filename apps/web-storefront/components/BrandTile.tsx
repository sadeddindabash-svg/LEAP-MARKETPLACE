import Link from "@/components/LocLink";
import SafeImage from "@/components/SafeImage";
import { resolveImageUrl } from "@/lib/api";

/** A brand on the home page ("Shop by brand"): a round photo with a fine ring and the name under it, no card around it. With no photo the circle shows the grey picture icon. 96 px across (60 to 68 px on a phone, 4 per line). */
export default function BrandTile({ href, name, photo }: { href: string; name: string; photo?: string | null }) {
  return (
    <Link href={href} data-testid="brand-tile" className="group flex flex-col items-center gap-2 p-1 text-center md:gap-3 md:p-1.5">
      <span data-testid="brand-tile-photo" className="relative grid size-[60px] place-items-center overflow-hidden rounded-full bg-[#e6edf2] text-[#8696a2] shadow-[0_0_0_3px_#fff,0_0_0_4px_#d3dae0] transition-shadow group-hover:shadow-[0_0_0_3px_#fff,0_0_0_4px_#fab219] min-[400px]:size-[68px] md:size-24">
        {photo ? (
          <SafeImage src={resolveImageUrl(photo)} alt="" fill sizes="96px" className="object-cover" unoptimized />
        ) : (
          <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg>
        )}
      </span>
      <span className="line-clamp-2 w-full min-w-0 text-[12px] font-bold leading-tight [overflow-wrap:anywhere] md:text-base">{name}</span>
    </Link>
  );
}
