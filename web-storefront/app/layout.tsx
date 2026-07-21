import type { Metadata } from "next";
import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Real brand fonts, carried over exactly from the established system
// in apps/mobile/lib/core/theme.dart / docs/prototypes/leap_mobile_prototype.jsx
// -- Barlow Condensed for display/headlines, Inter for body, JetBrains
// Mono for part numbers and the plate-chip fitment badge.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});
const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Leap Auto Parts — Real parts, direct from verified suppliers",
    template: "%s | Leap Auto Parts",
  },
  description:
    "Browse genuine and aftermarket auto parts by vehicle fitment, with verified suppliers, real photos, and real buyer reviews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-chalk text-ink">
        <header className="border-b border-line bg-white sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
            <Link
              href="/"
              className="font-display font-bold text-2xl tracking-tight text-ink"
            >
              LEAP<span className="text-signal">.</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href="/search" className="text-muted hover:text-ink">
                Search
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line bg-white">
          <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted">
            <p>© {new Date().getFullYear()} Leap Auto Parts.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
