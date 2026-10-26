import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import CustomerPhotos from "@/components/CustomerPhotos";
import LazyProductRow from "@/components/LazyProductRow";
import NotifyWhenInStock from "@/components/NotifyWhenInStock";
import OemComparison from "@/components/OemComparison";
import ProductGallery from "@/components/ProductGallery";
import ProductDetails from "@/components/ProductDetails";
import ReviewsSection from "@/components/ReviewsSection";
import ShareButton from "@/components/ShareButton";
import { WishlistButton } from "@/components/WishlistButton";
import { JsonLd } from "@/components/JsonLd";
import StockBanner from "@/components/StockBanner";
import SellerSignals from "@/components/SellerSignals";
import PriceBlock from "@/components/PriceBlock";
import {
  fetchCategories,
  fetchOemAlternatives,
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
  // The product and what the page needs at once: its reviews, the sections, the other listings of the same OEM number. The three rows of parts at the bottom (same model, same brand, newest) are NOT fetched
  // here: each one asks for itself when the buyer scrolls close to it (components/LazyProductRow.tsx).
  const [product, reviews, categories, oemMatches] = await Promise.all([
    fetchProductById(id, lang),
    fetchProductReviews(id),
    fetchCategories(),
    fetchOemAlternatives(id, lang),
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
          <ProductGallery images={product.images.map(resolveImageUrl)} alt={product.name} />
          <ProductDetails product={product} lang={lang} />
        </div>

        {/* The column beside the photos (title, price, Add to cart) stays in view while the photos and the details card are scrolled, and is released where they end. On a phone the page is one column: nothing is pinned.
            A very tall column (a long description) gets its own small scroll instead of hiding the buttons. The header does not stick, so a small gap at the top is enough. */}
        <div className="md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start md:overflow-y-auto md:pe-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display min-w-0 font-bold text-4xl tracking-tight [overflow-wrap:anywhere]">
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
          {/* Like the mobile app: the stock box with the delivery date, who ships it, then the price (with the old price and the discount when there is one). The description and the part number are in the specifications card. */}
          <StockBanner stockQuantity={product.stockQuantity} estimatedDeliveryDays={product.estimatedDeliveryDays} lang={lang} />
          <SellerSignals isVerifiedSeller={product.isVerifiedSeller} shipsFromCountry={product.shipsFromCountry} shipsFromCountryAr={product.shipsFromCountryAr} lang={lang} />
          <PriceBlock price={product.price} originalPrice={product.originalPrice} lang={lang} />

          <div className="mt-8">
            <AddToCartButton productId={product.id} inStock={product.stockQuantity > 0} unitPrice={product.price} maxQuantity={product.stockQuantity} />
            {product.stockQuantity === 0 && <div className="mt-3"><NotifyWhenInStock productId={product.id} /></div>}
            <WishlistButton productId={product.id} />
          </div>
        </div>
      </div>

      {/* The sections under a part, in the mobile app's order. Each one is drawn only when it has something to show. */}
      <OemComparison products={oemMatches} lang={lang} />
      <ReviewsSection productId={product.id} summary={reviews} />
      <CustomerPhotos reviews={reviews.reviews} lang={lang} />
      {(product.model || (product.fitCarCount ?? 0) > 0) && (
        <LazyProductRow id="model-h" title={t(lang, "more_model_parts", { name: [product.brand, product.model].filter(Boolean).join(" ") })} source={{ kind: "sameModel", productId: product.id }} pageSize={8} maxExtraPages={2} />
      )}
      {product.brand && <LazyProductRow id="brand-h" title={t(lang, "more_brand_parts", { brand: product.brand })} source={{ kind: "sameBrand", productId: product.id }} pageSize={8} maxExtraPages={2} />}
      <LazyProductRow id="newest-h" title={t(lang, "newest_products")} source={{ kind: "newest" }} pageSize={8} hiddenId={product.id} />
    </div>
  );
}
