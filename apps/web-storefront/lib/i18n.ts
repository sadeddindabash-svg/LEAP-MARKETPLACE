// The storefront speaks English and Arabic, like the mobile app. The language is part of the ADDRESS (/ar/search is the Arabic search page; /search is English), so a
// search engine can index each language on its own and a link always opens the language it was shared in. proxy.ts turns /ar/... into the normal route and passes the
// language along; nothing else about the routes changes.
//
// Everything here is plain functions so it can be tested without a server. A missing translation falls back to English (never blank, never a raw key), and the
// dictionary type makes a key without an Arabic text a compile error.

export type Lang = "en" | "ar";
export const LANGS: readonly Lang[] = ["en", "ar"];
export const DEFAULT_LANG: Lang = "en";
export const LANG_HEADER = "x-leap-lang";

export const isRtl = (lang: Lang): boolean => lang === "ar";

/** "/ar/search" gives { lang: "ar", path: "/search" }; "/search" gives { lang: "en", path: "/search" }. */
export function splitLang(pathname: string): { lang: Lang; path: string } {
  if (pathname === "/ar") return { lang: "ar", path: "/" };
  if (pathname.startsWith("/ar/")) return { lang: "ar", path: pathname.slice(3) };
  return { lang: "en", path: pathname || "/" };
}

/** The address of an internal path in a language: "/search?x=1" in Arabic is "/ar/search?x=1". Anything that is not an internal absolute path is left alone. */
export function localizePath(lang: Lang, path: string): string {
  if (lang !== "ar") return path;
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const { lang: already } = splitLang(path.split(/[?#]/)[0]);
  if (already === "ar") return path;
  if (path === "/" ) return "/ar";
  if (path.startsWith("/?") || path.startsWith("/#")) return `/ar${path.slice(1)}`;
  return `/ar${path}`;
}

/** The same page in the other language, keeping the query string: used by the language switch. */
export function switchLangPath(currentPathname: string, search: string, to: Lang): string {
  const { path } = splitLang(currentPathname);
  return localizePath(to, `${path}${search ? (search.startsWith("?") ? search : `?${search}`) : ""}`);
}

/** The hreflang set for a page: its address in each language, plus the default. `path` is the English (unprefixed) path. */
export function languageAlternates(path: string, absolute: (p: string) => string): Record<string, string> {
  return { en: absolute(path), ar: absolute(localizePath("ar", path)), "x-default": absolute(path) };
}

const EN = {
  site_title: "Leap Auto Parts — Real parts, direct from verified suppliers",
  site_description: "Browse genuine and aftermarket auto parts by vehicle fitment, with verified suppliers, real photos, and real buyer reviews.",
  // header
  util_tagline: "Largest ready-to-ship warehouse for Chinese auto parts",
  support: "Support",
  language_name: "English",
  other_language_name: "العربية",
  skip_to_content: "Skip to content",
  nav_home: "Home",
  nav_products: "Products",
  nav_sections: "Sections",
  sign_in: "Sign in",
  sign_out: "Sign out",
  logo_home_label: "Leap Auto Parts, home",
  account_menu: "My account",
  account: "Account",
  wishlist: "Wishlist",
  notifications: "Notifications",
  cart: "Cart",
  search_label: "Search parts",
  search_placeholder: "Search by part name, part number or VIN",
  search_button: "Search",
  all_sections: "All sections",
  announce_warehouse: "Opening Middle East warehouse in Saudi Arabia",
  announce_shipping: "International shipping in 3-7 days",
  // home
  hero_title: "Find the right part for your car",
  hero_lead: "Real parts from verified suppliers, matched to your vehicle.",
  picker_title: "Find parts for your car",
  picker_brand: "Brand",
  picker_model: "Model",
  picker_year: "Year",
  picker_choose_brand: "Choose a brand",
  picker_choose_model: "Choose a model",
  picker_choose_year: "Choose a year",
  picker_cta: "Show parts that fit",
  stat_parts: "parts",
  stat_brands: "vehicle brands",
  stat_sections: "sections",
  shop_by_section: "Shop by section",
  shop_by_brand: "Shop by brand",
  newest_parts: "Newest parts",
  see_all_parts: "See all parts",
  see_all_sections: "See all sections",
  // product cards and pages
  add_to_cart: "Add to cart",
  delivery_in_days: "Delivery in {n} days",
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  part_number: "Part number",
  reviews_count: "{n} reviews",
  // search page
  search_all_parts: "Browse all parts",
  search_results_for: "Search results for \"{q}\"",
  no_parts_found: "No parts found.",
  // footer
  footer_tagline: "Real parts, direct from verified suppliers.",
  footer_useful_links: "Useful links",
  footer_my_account: "My account",
  footer_help: "Help",
  footer_shop: "Shop",
  my_orders: "My orders",
  returns: "Returns",
  saved_searches: "Saved searches",
  referrals: "Refer a friend",
  about_us: "About us",
  terms: "Terms & Conditions",
  delivery_shipping: "Delivery & Shipping",
  refund_policy: "Refund",
  privacy_policy: "Privacy Policy",
  cancellation_policy: "Cancellation",
  adding: "Adding…",
  added: "Added",
  add_failed: "Couldn't add, please try again",
  decrease_quantity: "Decrease quantity",
  increase_quantity: "Increase quantity",
  no_reviews_yet: "No reviews yet for this part.",
  part_not_found: "Part not found",
  view_part: "View part",
  search_page_placeholder: "Search by part name, OEM number, or vehicle...",
  search_loading: "Loading…",
  category_label: "Category",
  no_parts_vehicle: "No parts match your vehicle yet. Try browsing without the vehicle filter.",
  no_parts_search: "No parts match your search. Try a different term or category.",
  search_pages_nav: "Search results pages",
  previous: "Previous",
  next: "Next",
  parts_found_one: "1 part found",
  parts_found: "{n} parts found",
  matching_vehicle: "matching your vehicle",
  page_x_of_y: "Page {page} of {total}",
  my_vehicle: "My vehicle",
  clear: "Clear",
  select_brand: "Select brand…",
  select_model: "Select model…",
  select_generation: "Select generation…",
  any_year: "Any year in this generation",
  present: "present",
  save_search: "Save this search",
  saved_search_done: "✓ Saved — we'll notify you of new matches",
  name_this_search: "Name this search",
  save: "Save",
  my_search: "My search",
  failed_to_save: "Failed to save",
  no_photo: "No photo",
  fits_label: "FITS",
  est_delivery_in: "Estimated delivery in {n} days",
  oem_number: "OEM number",
  reviews_heading: "Reviews",
  reviews_summary_one: "{avg} average · 1 review",
  reviews_summary_many: "{avg} average · {n} reviews",
  buyer: "Buyer",
  verified_purchase: "✓ Verified Purchase",
  wishlist_loading: "♡ Wishlist",
  log_in_to_save: "♡ Log in to save",
  saved_to_wishlist: "♥ Saved to wishlist",
  add_to_wishlist: "♡ Add to wishlist",
  desc_oem: "OEM {n}.",
  desc_fits: "Fits {v}.",
  desc_in_stock: "In stock.",
  desc_out_of_stock: "Currently out of stock.",
  desc_delivery: "Estimated delivery {n} days.",
  category_title: "{name} parts",
  category_description: "Shop {name} parts by vehicle fitment from verified suppliers, with real photos and clear prices.",
  copyright: "Copyright © Leap Auto Parts {year}",
} as const;

export type DictKey = keyof typeof EN;

const AR: Record<DictKey, string> = {
  site_title: "ليب لقطع السيارات — قطع حقيقية مباشرة من موردين موثوقين",
  site_description: "تصفح قطع غيار السيارات الأصلية والبديلة حسب توافق مركبتك، مع موردين موثوقين وصور حقيقية وتقييمات حقيقية من المشترين.",
  util_tagline: "أكبر مستودع جاهز للشحن لقطع غيار السيارات الصينية",
  support: "الدعم",
  language_name: "العربية",
  other_language_name: "English",
  skip_to_content: "انتقل إلى المحتوى",
  nav_home: "الرئيسية",
  nav_products: "المنتجات",
  nav_sections: "الأقسام",
  sign_in: "تسجيل الدخول",
  sign_out: "تسجيل الخروج",
  logo_home_label: "ليب لقطع السيارات، الرئيسية",
  account_menu: "حسابي",
  account: "الحساب",
  wishlist: "المفضلة",
  notifications: "الإشعارات",
  cart: "السلة",
  search_label: "ابحث عن قطع",
  search_placeholder: "ابحث باسم القطعة أو رقمها أو رقم الهيكل",
  search_button: "بحث",
  all_sections: "كل الأقسام",
  announce_warehouse: "افتتاح مستودع الشرق الأوسط في السعودية",
  announce_shipping: "شحن دولي خلال 3-7 أيام",
  hero_title: "اعثر على القطعة المناسبة لسيارتك",
  hero_lead: "قطع حقيقية من موردين موثوقين، مطابقة لمركبتك.",
  picker_title: "ابحث عن قطع لسيارتك",
  picker_brand: "الماركة",
  picker_model: "الموديل",
  picker_year: "السنة",
  picker_choose_brand: "اختر الماركة",
  picker_choose_model: "اختر الموديل",
  picker_choose_year: "اختر السنة",
  picker_cta: "اعرض القطع المناسبة",
  stat_parts: "قطعة",
  stat_brands: "ماركة مركبات",
  stat_sections: "قسم",
  shop_by_section: "تسوق حسب القسم",
  shop_by_brand: "تسوق حسب الماركة",
  newest_parts: "أحدث القطع",
  see_all_parts: "عرض كل القطع",
  see_all_sections: "عرض كل الأقسام",
  add_to_cart: "أضف إلى السلة",
  delivery_in_days: "التوصيل خلال {n} أيام",
  in_stock: "متوفر",
  out_of_stock: "غير متوفر",
  part_number: "رقم القطعة",
  reviews_count: "{n} تقييمات",
  search_all_parts: "تصفح كل القطع",
  search_results_for: "نتائج البحث عن \"{q}\"",
  no_parts_found: "لم يتم العثور على قطع.",
  footer_tagline: "قطع حقيقية مباشرة من موردين موثوقين.",
  footer_useful_links: "روابط مفيدة",
  footer_my_account: "حسابي",
  footer_help: "المساعدة",
  footer_shop: "تسوق",
  my_orders: "طلباتي",
  returns: "المرتجعات",
  saved_searches: "عمليات البحث المحفوظة",
  referrals: "ادعُ صديقًا",
  about_us: "من نحن",
  terms: "الشروط والأحكام",
  delivery_shipping: "التوصيل والشحن",
  refund_policy: "الاسترداد",
  privacy_policy: "سياسة الخصوصية",
  cancellation_policy: "الإلغاء",
  adding: "جارٍ الإضافة…",
  added: "تمت الإضافة",
  add_failed: "تعذّرت الإضافة، يرجى المحاولة مرة أخرى",
  decrease_quantity: "تقليل الكمية",
  increase_quantity: "زيادة الكمية",
  no_reviews_yet: "لا توجد تقييمات لهذه القطعة بعد.",
  part_not_found: "القطعة غير موجودة",
  view_part: "عرض القطعة",
  search_page_placeholder: "ابحث باسم القطعة أو رقم OEM أو المركبة...",
  search_loading: "جارٍ التحميل…",
  category_label: "القسم",
  no_parts_vehicle: "لا توجد قطع مطابقة لمركبتك بعد. جرّب التصفح بدون فلتر المركبة.",
  no_parts_search: "لا توجد قطع مطابقة لبحثك. جرّب كلمة أو قسمًا آخر.",
  search_pages_nav: "صفحات نتائج البحث",
  previous: "السابق",
  next: "التالي",
  parts_found_one: "تم العثور على قطعة واحدة",
  parts_found: "تم العثور على {n} قطعة",
  matching_vehicle: "تطابق مركبتك",
  page_x_of_y: "الصفحة {page} من {total}",
  my_vehicle: "مركبتي",
  clear: "مسح",
  select_brand: "اختر الماركة…",
  select_model: "اختر الموديل…",
  select_generation: "اختر الجيل…",
  any_year: "أي سنة في هذا الجيل",
  present: "حتى الآن",
  save_search: "احفظ هذا البحث",
  saved_search_done: "✓ تم الحفظ — سنخبرك بالنتائج الجديدة",
  name_this_search: "سمِّ هذا البحث",
  save: "حفظ",
  my_search: "بحثي",
  failed_to_save: "تعذّر الحفظ",
  no_photo: "لا توجد صورة",
  fits_label: "تناسب",
  est_delivery_in: "التوصيل المتوقع خلال {n} أيام",
  oem_number: "رقم OEM",
  reviews_heading: "التقييمات",
  reviews_summary_one: "المتوسط {avg} · تقييم واحد",
  reviews_summary_many: "المتوسط {avg} · {n} تقييمات",
  buyer: "مشترٍ",
  verified_purchase: "✓ عملية شراء موثقة",
  wishlist_loading: "♡ المفضلة",
  log_in_to_save: "♡ سجّل الدخول للحفظ",
  saved_to_wishlist: "♥ تم الحفظ في المفضلة",
  add_to_wishlist: "♡ أضف إلى المفضلة",
  desc_oem: "رقم OEM {n}.",
  desc_fits: "تناسب {v}.",
  desc_in_stock: "متوفر.",
  desc_out_of_stock: "غير متوفر حاليًا.",
  desc_delivery: "التوصيل المتوقع خلال {n} أيام.",
  category_title: "قطع {name}",
  category_description: "تسوق قطع {name} حسب توافق مركبتك من موردين موثوقين، بصور حقيقية وأسعار واضحة.",
  copyright: "حقوق النشر © ليب لقطع السيارات {year}",
};

export const DICTIONARIES: Record<Lang, Record<DictKey, string>> = { en: EN, ar: AR };

/** The text for [key] in [lang], with {name} placeholders filled from [vars]. Falls back to English, then to the key itself. */
export function t(lang: Lang, key: DictKey, vars?: Record<string, string | number>): string {
  const text = DICTIONARIES[lang]?.[key] ?? DICTIONARIES.en[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** A name that has an Arabic version (categories, parts, vehicles): the Arabic one in Arabic when it exists, else the English one. */
export function pickName(lang: Lang, en: string, ar?: string | null): string {
  return lang === "ar" && ar && ar.trim() ? ar : en;
}
