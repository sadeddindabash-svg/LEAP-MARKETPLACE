import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { WishlistButton } from "@/components/WishlistButton";
import { JsonLd } from "@/components/JsonLd";
import { Price } from "@/components/Price";
import {
  fetchCategories,
  fetchProductById,
  fetchProductReviews,
  resolveImageUrl,
} from "@/lib/api";
import { pickName, localizePath, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { SITE_NAME, absoluteUrl, alternatesFor, breadcrumbJsonLd, productDescription, productJsonLd, productTitle } from "@/lib/seo";

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
  const lang = await getLang();
  const product = await fetchProductById(id, lang);
  if (!product) return { title: t(lang, "part_not_found"), robots: { index: false, follow: false } };
  // Built from what the product really has (name, part number, fitment, stock, price): see lib/seo.ts.
  const title = productTitle(product);
  const description = productDescription(product, lang);
  const images = product.images[0] ? [resolveImageUrl(product.images[0])] : undefined;
  return {
    title,
    description,
    alternates: alternatesFor(lang, `/products/${product.id}`),
    openGraph: { title, description, url: absoluteUrl(localizePath(lang, `/products/${product.id}`)), siteName: SITE_NAME, type: "website", images, locale: lang === "ar" ? "ar_AR" : "en_US" },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, images },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const lang = await getLang();
  const [product, reviews, categories] = await Promise.all([
    fetchProductById(id, lang),
    fetchProductReviews(id),
    fetchCategories(),
  ]);

  if (!product) notFound();

  const found = categories.find((c) => c.id === product.category);
  const categoryName = found ? pickName(lang, found.nameEn, found.nameAr) : undefined;
  const productUrl = absoluteUrl(localizePath(lang, `/products/${product.id}`));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Structured data: the price and stock a search result can show, the REAL review rating (only if real reviews exist), and the breadcrumb trail. */}
      <JsonLd data={productJsonLd(product, reviews, { url: productUrl, imageUrls: product.images.map(resolveImageUrl), categoryName })} />
      <JsonLd data={breadcrumbJsonLd([
        { name: t(lang, "nav_home"), path: localizePath(lang, "/") },
        ...(categoryName ? [{ name: categoryName, path: localizePath(lang, `/search?category=${encodeURIComponent(product.category)}`) }] : []),
        { name: product.name, path: localizePath(lang, `/products/${product.id}`) },
      ])} />
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
                {t(lang, "no_photo")}
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
                {t(lang, "fits_label")} {product.year ? `${product.year} ` : ""}
                {product.brand} {product.model || ""}
              </span>
            )}
          </div>
          <p className="mt-6 font-display font-bold text-4xl">
            <Price usd={product.price} />
          </p>
          <p
            className={`mt-1 text-sm font-medium ${
              product.stockQuantity > 0 ? "text-gauge" : "text-muted"
            }`}
          >
            {t(lang, product.stockQuantity > 0 ? "in_stock" : "out_of_stock")}
            {product.estimatedDeliveryDays
              ? ` · ${t(lang, "est_delivery_in", { n: product.estimatedDeliveryDays })}`
              : ""}
          </p>

          {product.description && (
            <p className="mt-6 text-muted leading-relaxed">
              {product.description}
            </p>
          )}

          {product.oemNumber && (
            <p className="mt-6 text-sm text-muted">
              {t(lang, "oem_number")}:{" "}
              <span className="font-plate font-semibold text-ink">
                {product.oemNumber}
              </span>
            </p>
          )}

          <div className="mt-8">
            <AddToCartButton productId={product.id} inStock={product.stockQuantity > 0} />
            <WishlistButton productId={product.id} />
          </div>
        </div>
      </div>

      <section className="mt-16 border-t border-line pt-10">
        <h2 className="font-display font-bold text-2xl tracking-tight mb-6">
          {t(lang, "reviews_heading")}
          {reviews.reviewCount > 0 && (
            <span className="ms-2 text-muted font-body font-normal text-base">
              {t(lang, reviews.reviewCount === 1 ? "reviews_summary_one" : "reviews_summary_many", { avg: reviews.averageRating?.toFixed(1) ?? "", n: reviews.reviewCount })}
            </span>
          )}
        </h2>
        {reviews.reviews.length === 0 ? (
          <p className="text-muted">{t(lang, "no_reviews_yet")}</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {reviews.reviews.map((r) => (
              <div key={r.id} className="rounded-lg border border-line bg-white p-4">
                <p className="font-semibold text-sm">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </p>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                <p className="mt-2 text-xs text-muted flex items-center gap-2">
                  <span>
                    {r.buyerName || t(lang, "buyer")} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                  {r.isVerifiedPurchase && (
                    <span className="text-[10px] font-bold text-gauge bg-[#E8F7F0] px-1.5 py-0.5 rounded">
                      {t(lang, "verified_purchase")}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
