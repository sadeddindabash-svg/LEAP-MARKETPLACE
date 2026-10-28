import type { Metadata } from "next";
import { SITE_FONTS_HREF, SITE_FONT_VARS } from "@/lib/siteFonts";
import { CartProvider } from "@/components/CartProvider";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { GarageProvider } from "@/components/GarageProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { LangProvider } from "@/components/LangProvider";
import BackToTop from "@/components/BackToTop";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { isRtl, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { SITE_NAME, siteUrl } from "@/lib/seo";
import "./globals.css";

// Outfit for English and IBM Plex Sans Arabic for Arabic (the theme is "Navy Workshop": see components/SiteHeader.tsx). JetBrains Mono stays for part numbers and the
// plate-chip fitment badge.
// (The fonts are linked, not downloaded while the site is built: see lib/siteFonts.ts.)

// The title, description and share card follow the page's language (the language is part of the address: /ar/... is Arabic).
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    // Every relative address in a page's metadata (canonical, share image) is resolved against this: set NEXT_PUBLIC_SITE_URL to the real https address.
    metadataBase: new URL(siteUrl()),
    openGraph: { siteName: SITE_NAME, type: "website", locale: lang === "ar" ? "ar_AR" : "en_US" },
    title: { default: t(lang, "site_title"), template: lang === "ar" ? "%s | ليب لقطع السيارات" : "%s | Leap Auto Parts" },
    description: t(lang, "site_description"),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"} className="h-full antialiased" style={SITE_FONT_VARS}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={SITE_FONTS_HREF} />
      </head>
      <body className="flex min-h-full flex-col bg-chalk text-ink">
        <LangProvider lang={lang}>
          <AuthProvider>
            <GarageProvider>
              <CurrencyProvider>
                <CartProvider>
                  <SiteHeader lang={lang} />
                  <main id="main" className="flex-1">{children}</main>
                  <SiteFooter lang={lang} />
                  <BackToTop />
                </CartProvider>
              </CurrencyProvider>
            </GarageProvider>
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
