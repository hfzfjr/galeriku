import type { Metadata, Viewport } from "next";
import "./globals.css";
import { serifFont, sansFont } from "./fonts";
import { ThemeProvider } from "@/components/theme-provider";
import { THEME_INIT_SCRIPT } from "@/components/theme";

export const metadata: Metadata = {
  title: {
    default: "Galeriku",
    template: "%s · Galeriku",
  },
  description:
    "Ruang simpan pribadi untuk foto dan videomu. Bagikan lewat satu link.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  // theme-color mengikuti paper terang/gelap. Catatan: tidak ikut berubah
  // saat tema dipilih manual (Terang/Gelap) — keterbatasan yang diterima.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F0E4" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1814" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${serifFont.variable} ${sansFont.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        {/* Skrip tema: anak pertama body agar dieksekusi sinkron saat
            parsing, sebelum paint. App Router mengelola <head> lewat
            Metadata API, jadi skrip ditaruh di sini dengan efek setara. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
