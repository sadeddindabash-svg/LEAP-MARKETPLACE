import { resolveImageUrl } from "@/lib/api";

/**
 * One of the four totals at the top of the home page (parts, brands, models, countries): a GOLD tile that is filled edge to edge, a big navy number and its label, and a huge faint icon that is part of the tile. When the admin chose a
 * picture for it, the picture fills the tile under a gold wash (strong on the text side, lighter on the other). 92 px high.
 */
export default function StatTile({ n, label, paths, picture }: { n: string; label: string; paths: string[]; picture?: string | null }) {
  return (
    <li data-testid="stat-tile" className="relative flex h-[92px] items-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[#ffc83d] to-[#f4a400] px-4 sm:px-5">
      {picture ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a plain picture under a wash; its size is the tile's */}
          <img src={resolveImageUrl(picture)} alt="" className="absolute inset-0 size-full object-cover" />
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#fab219]/95 from-35% to-[#fab219]/35 rtl:bg-gradient-to-l" />
        </>
      ) : (
        <svg aria-hidden="true" data-testid="stat-tile-icon" width="108" height="108" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="absolute -bottom-4 -end-2 text-navy opacity-[0.17]">
          {paths.map((d) => <path key={d} d={d} />)}
        </svg>
      )}
      <span className="relative min-w-0"><b className="block text-[30px] font-extrabold leading-none text-navy sm:text-[34px]">{n}</b><span className="mt-1 block text-[14px] font-medium text-[#3d3318] sm:text-[15px]">{label}</span></span>
    </li>
  );
}
