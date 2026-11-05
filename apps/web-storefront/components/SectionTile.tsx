import Link from "@/components/LocLink";
import SafeImage from "@/components/SafeImage";
import { resolveImageUrl } from "@/lib/api";

/**
 * A section on the home page ("Shop by section"): a wide tile, the name on one side and the section's photo in an ANGLED panel on the other (the angle is mirrored in Arabic), like the "Shopping for" container. The photo fills its panel
 * edge to edge; with no photo the panel shows the grey picture icon. 104 px high.
 * On a phone (under 768 px): a square photo with the name under it, 4 per line (confirmed with the person via mockup).
 */
export default function SectionTile({ href, name, photo }: { href: string; name: string; photo?: string | null }) {
  return (
    <Link href={href} data-testid="section-tile" className="group flex flex-col items-center gap-1.5 text-center md:h-[104px] md:flex-row md:items-stretch md:gap-0 md:overflow-hidden md:rounded-[14px] md:border md:border-line md:bg-white md:text-start md:transition-colors md:hover:border-signal">
      <span className="order-2 line-clamp-2 w-full min-w-0 text-[11.5px] font-bold leading-tight [overflow-wrap:anywhere] md:order-none md:flex md:w-auto md:flex-1 md:items-center md:px-5 md:text-[17px]">{name}</span>
      <span data-testid="section-tile-photo" className="relative order-1 grid aspect-square w-full shrink-0 place-items-center overflow-hidden rounded-[14px] border border-line bg-[#e6edf2] text-[#8696a2] transition-colors group-hover:border-signal md:order-none md:aspect-auto md:w-[44%] md:rounded-none md:border-0 md:[clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)] md:rtl:[clip-path:polygon(0_0,78%_0,100%_100%,0_100%)]">
        {photo ? (
          <SafeImage src={resolveImageUrl(photo)} alt="" fill sizes="(min-width: 768px) 130px, 90px" className="object-cover" unoptimized />
        ) : (
          <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg>
        )}
      </span>
    </Link>
  );
}
