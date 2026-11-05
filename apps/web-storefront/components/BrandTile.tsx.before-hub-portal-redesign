import Link from "@/components/LocLink";
import SafeImage from "@/components/SafeImage";
import { resolveImageUrl } from "@/lib/api";

/** A brand on the home page ("Shop by brand"): a round photo with a fine ring and the name under it, no card around it. With no photo the circle shows the grey picture icon. 96 px across (76 px on a phone). */
export default function BrandTile({ href, name, photo }: { href: string; name: string; photo?: string | null }) {
  return (
    <Link href={href} data-testid="brand-tile" className="group flex flex-col items-center gap-3 p-1.5 text-center">
      <span data-testid="brand-tile-photo" className="relative grid size-[76px] place-items-center overflow-hidden rounded-full bg-[#e6edf2] text-[#8696a2] shadow-[0_0_0_3px_#fff,0_0_0_4px_#d3dae0] transition-shadow group-hover:shadow-[0_0_0_3px_#fff,0_0_0_4px_#fab219] sm:size-24">
        {photo ? (
          <SafeImage src={resolveImageUrl(photo)} alt="" fill sizes="96px" className="object-cover" unoptimized />
        ) : (
          <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg>
        )}
      </span>
      <span className="line-clamp-2 w-full min-w-0 text-[15px] font-bold leading-tight [overflow-wrap:anywhere] sm:text-base">{name}</span>
    </Link>
  );
}
