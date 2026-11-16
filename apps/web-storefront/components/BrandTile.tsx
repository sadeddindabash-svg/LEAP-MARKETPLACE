import Link from "@/components/LocLink";
import SafeImage from "@/components/SafeImage";
import { resolveImageUrl } from "@/lib/api";

/** A brand on the home page ("Shop by brand"): a round photo with no border (a gold one shows only on hover) and the name under it, no card around it.
 *  No white ring: the circle has the page colour, and the logo picture is "multiplied" onto it, so a logo's white background takes the page colour too (confirmed with the person via mockup). With no photo the circle shows the grey picture icon. 96 px across (60 to 68 px on a phone, 4 per line). */
export default function BrandTile({ href, name, photo }: { href: string; name: string; photo?: string | null }) {
  return (
    <Link href={href} data-testid="brand-tile" className="group flex flex-col items-center gap-2 p-1 text-center md:gap-3 md:p-1.5">
      <span data-testid="brand-tile-photo" className="relative grid size-[60px] place-items-center overflow-hidden rounded-full border-[1.5px] border-transparent bg-chalk text-[#8696a2] transition-colors group-hover:border-signal min-[400px]:size-[68px] md:size-24">
        {photo ? (
          <SafeImage src={resolveImageUrl(photo)} alt="" fill sizes="96px" className="object-cover mix-blend-multiply" unoptimized />
        ) : (
          <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg>
        )}
      </span>
      <span className="line-clamp-2 w-full min-w-0 text-[12px] font-bold leading-tight [overflow-wrap:anywhere] md:text-base">{name}</span>
    </Link>
  );
}
