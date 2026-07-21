import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import {
  fetchProductById,
  fetchProductReviews,
  resolveImageUrl,
} from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Real, per-product SEO metadata -- generated server-side from the
// real product's own real name/description, so a search result for
// this exact part shows its real title and a real, specific snippet,
// not a generic site-wide description repeated on every page.
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProductById(id);
  if (!product) return { title: "Part not found" };
  return {
    title: product.name,
    description:
      product.description ||
      `${product.name} — real fitment, verified supplier, on Leap Auto Parts.`,
    openGraph: {
      title: product.name,
      description: product.description || undefined,
      images: product.images[0] ? [resolveImageUrl(product.images[0])] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const [product, reviews] = await Promise.all([
    fetchProductById(id),
    fetchProductReviews(id),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <div className="aspect-square rounded-lg border border-line bg-white overflow-hidden">
            {product.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveImageUrl(product.images[0])}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">
                No photo
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {product.images.slice(1, 6).map((url) => (
                <div
                  key={url}
                  className="aspect-square rounded-md border border-line bg-white overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveImageUrl(url)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight">
            {product.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.part && <span className="plate-chip">{product.part}</span>}
            {product.brand && (
              <span className="plate-chip">
                FITS {product.year ? `${product.year} ` : ""}
                {product.brand} {product.model || ""}
              </span>
            )}
          </div>
          <p className="mt-6 font-display font-bold text-4xl">
            ${product.price.toFixed(2)}
          </p>
          <p
            className={`mt-1 text-sm font-medium ${
              product.stockQuantity > 0 ? "text-gauge" : "text-muted"
            }`}
          >
            {product.stockQuantity > 0 ? "In stock" : "Out of stock"}
            {product.estimatedDeliveryDays
              ? ` · Estimated delivery in ${product.estimatedDeliveryDays} days`
              : ""}
          </p>

          {product.description && (
            <p className="mt-6 text-muted leading-relaxed">
              {product.description}
            </p>
          )}

          {product.oemNumber && (
            <p className="mt-6 text-sm text-muted">
              OEM number:{" "}
              <span className="font-plate font-semibold text-ink">
                {product.oemNumber}
              </span>
            </p>
          )}

          <div className="mt-8">
            <AddToCartButton productId={product.id} inStock={product.stockQuantity > 0} />
          </div>
        </div>
      </div>

      <section className="mt-16 border-t border-line pt-10">
        <h2 className="font-display font-bold text-2xl tracking-tight mb-6">
          Reviews
          {reviews.reviewCount > 0 && (
            <span className="ml-2 text-muted font-body font-normal text-base">
              {reviews.averageRating?.toFixed(1)} average · {reviews.reviewCount}{" "}
              review{reviews.reviewCount === 1 ? "" : "s"}
            </span>
          )}
        </h2>
        {reviews.reviews.length === 0 ? (
          <p className="text-muted">No reviews yet for this part.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {reviews.reviews.map((r) => (
              <div key={r.id} className="rounded-lg border border-line bg-white p-4">
                <p className="font-semibold text-sm">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </p>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                <p className="mt-2 text-xs text-muted">
                  {r.buyerName || "Buyer"} ·{" "}
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
