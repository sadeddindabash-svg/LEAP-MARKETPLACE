import InfiniteProductGrid from "@/components/InfiniteProductGrid";
import type { ProductSummary } from "@/lib/api";

export const PAGE_SIZE = 10;

type Source = { kind: "sameBrand"; productId: string } | { kind: "newest"; excludeId: string };

/**
 * A titled list at the bottom of a product page ("More from this brand", "Newest products"). Its first page is drawn on the server (so it is in the page's HTML); more parts
 * load by themselves as the buyer scrolls (see InfiniteProductGrid). Two more pages at most, then "See all parts": these lists sit above the footer, and without that stop
 * the first one would go on loading the whole brand and the second would never be reached. The part being looked at is never listed, but still counts as received (a full
 * page that happened to contain it must not look short, or the loading would stop too early).
 */
export default function LoadMoreGrid({ id, title, initial, source }: { id: string; title: string; initial: ProductSummary[]; source: Source }) {
  const hiddenId = source.kind === "newest" ? source.excludeId : undefined;
  if (initial.filter((p) => p.id !== hiddenId).length === 0) return null;
  return (
    <section className="mt-14" aria-labelledby={id}>
      <h2 id={id} className="mb-5 text-2xl font-bold tracking-tight">{title}</h2>
      <InfiniteProductGrid
        id={id}
        source={source.kind === "sameBrand" ? { kind: "sameBrand", productId: source.productId } : { kind: "newest" }}
        initial={initial}
        total={null}
        pageSize={PAGE_SIZE}
        hiddenId={hiddenId}
        maxExtraPages={2}
        seeAllHref="/search"
        gridClassName="grid grid-cols-2 gap-5 lg:grid-cols-4"
      />
    </section>
  );
}
