import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import ConfirmedFit from "@/components/ConfirmedFit";
import CustomerPhotos from "@/components/CustomerPhotos";
import LoadMoreGrid from "@/components/LoadMoreGrid";
import NotifyWhenInStock from "@/components/NotifyWhenInStock";
import OemComparison from "@/components/OemComparison";
import ProductGallery from "@/components/ProductGallery";
import ProductSection from "@/components/ProductSection";
import ReviewsSection from "@/components/ReviewsSection";
import ShareButton from "@/components/ShareButton";
import { WishlistButton } from "@/components/WishlistButton";
import { JsonLd } from "@/components/JsonLd";
import { Price } from "@/components/Price";
import {
  fetchAlternatives,
  fetchCategories,
  fetchOemAlternatives,
  fetchProductById,
  fetchProductReviews,
  fetchProductsPaginated,
  fetchSameBrand,
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
  // The product and everything under it, fetched together: the other listings of the same OEM number, similar parts, more of the brand, the newest parts.
  const [product, reviews, categories, oemMatches, alternatives, sameBrand, newest] = await Promise.all([
    fetchProductById(id, lang),
    fetchProductReviews(id),
    fetchCategories(),
    fetchOemAlternatives(id, lang),
    fetchAlternatives(id, lang),
    fetchSameBrand(id, lang, 1),
    fetchProductsPaginated({ sort: "newest", page: 1, limit: 10, lang }),
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
        <ProductGallery images={product.images.map(resolveImageUrl)} alt={product.name} />

        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display font-bold text-4xl tracking-tight">
              {product.name}
            </h1>
            <ShareButton title={product.name} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.part && <span className="plate-chip">{product.part}</span>}
            {product.brand && (
              <span className="plate-chip">
                {t(lang, "fits_label")} {product.year ? `${product.year} ` : ""}
                {product.brand} {product.model || ""}
              </span>
            )}
          </div>
          <ConfirmedFit fitsVehicleIds={product.fitsVehicleIds} />
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
            {product.stockQuantity === 0 && <div className="mt-3"><NotifyWhenInStock productId={product.id} /></div>}
            <WishlistButton productId={product.id} />
          </div>
        </div>
      </div>

      {/* The sections under a part, in the mobile app's order. Each one is drawn only when it has something to show. */}
      <OemComparison products={oemMatches} lang={lang} />
      <ReviewsSection productId={product.id} summary={reviews} />
      <CustomerPhotos reviews={reviews.reviews} lang={lang} />
      <ProductSection id="similar-h" title={t(lang, "similar_products")} products={alternatives} lang={lang} />
      <LoadMoreGrid id="brand-h" title={t(lang, "more_brand_parts", { brand: sameBrand[0]?.brand ?? product.brand ?? "" })} initial={sameBrand} source={{ kind: "sameBrand", productId: product.id }} />
      <LoadMoreGrid id="newest-h" title={t(lang, "newest_products")} initial={newest.items} source={{ kind: "newest", excludeId: product.id }} />
    </div>
  );
}
