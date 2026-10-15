import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, JetBrains_Mono, Outfit } from "next/font/google";
import { CartProvider } from "@/components/CartProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { LangProvider } from "@/components/LangProvider";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { isRtl, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { SITE_NAME, siteUrl } from "@/lib/seo";
import "./globals.css";

// Outfit for English and IBM Plex Sans Arabic for Arabic (the theme is "Navy Workshop": see components/SiteHeader.tsx). JetBrains Mono stays for part numbers and the
// plate-chip fitment badge.
const outfit = Outfit({ variable: "--font-outfit", weight: ["400", "500", "600", "700", "800"], subsets: ["latin"] });
const plexArabic = IBM_Plex_Sans_Arabic({ variable: "--font-arabic", weight: ["400", "500", "600", "700"], subsets: ["arabic"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", weight: ["500", "600", "700"], subsets: ["latin"] });

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
    <html lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"} className={`${outfit.variable} ${plexArabic.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-chalk text-ink">
        <LangProvider lang={lang}>
          <AuthProvider>
            <CartProvider>
              <SiteHeader lang={lang} />
              <main id="main" className="flex-1">{children}</main>
              <SiteFooter lang={lang} />
            </CartProvider>
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
