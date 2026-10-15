import ProductCard from "@/components/ProductCard";
import type { ProductSummary } from "@/lib/api";
import type { Lang } from "@/lib/i18n";

/** A titled row of product cards ("Similar products"). Nothing is drawn when there are none. */
export default function ProductSection({ id, title, products, lang }: { id: string; title: string; products: ProductSummary[]; lang: Lang }) {
  if (products.length === 0) return null;
  return (
    <section className="mt-14" aria-labelledby={id}>
      <h2 id={id} className="mb-5 text-2xl font-bold tracking-tight">{title}</h2>
      <ul className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {products.map((p) => <ProductCard key={p.id} product={p} lang={lang} />)}
      </ul>
    </section>
  );
}
