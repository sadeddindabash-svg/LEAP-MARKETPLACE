import Link from "@/components/LocLink";
import SafeImage from "@/components/SafeImage";
import { resolveImageUrl } from "@/lib/api";

/**
 * A section on the home page ("Shop by section"): a wide tile, the name on one side and the section's photo in an ANGLED panel on the other (the angle is mirrored in Arabic), like the "Shopping for" container. The photo fills its panel
 * edge to edge; with no photo the panel shows the grey picture icon. 104 px high (80 px on a phone).
 */
export default function SectionTile({ href, name, photo }: { href: string; name: string; photo?: string | null }) {
  return (
    <Link href={href} data-testid="section-tile" className="flex h-20 overflow-hidden rounded-[14px] border border-line bg-white transition-colors hover:border-signal sm:h-[104px]">
      <span className="line-clamp-2 flex min-w-0 flex-1 items-center px-3 text-[14.5px] font-bold leading-tight [overflow-wrap:anywhere] sm:px-5 sm:text-[17px]">{name}</span>
      <span data-testid="section-tile-photo" className="relative grid w-[44%] shrink-0 place-items-center bg-[#e6edf2] text-[#8696a2] [clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)] rtl:[clip-path:polygon(0_0,78%_0,100%_100%,0_100%)]">
        {photo ? (
          <SafeImage src={resolveImageUrl(photo)} alt="" fill sizes="(min-width: 1024px) 130px, 90px" className="object-cover" unoptimized />
        ) : (
          <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg>
        )}
      </span>
    </Link>
  );
}
