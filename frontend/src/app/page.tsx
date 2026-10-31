import type { Metadata } from "next";
import {
  CtaSection,
  Hero,
  HowItWorks,
  RulesSection,
  SiteFooter,
  SiteHeader,
} from "@/components/landing/sections";

const LANDING_TITLE =
  "Galeriku, simpan foto perjalananmu dan kirim satu link";
const LANDING_DESCRIPTION =
  "Ruang simpan berkelas untuk foto dan video resolusi penuh. Bagikan lewat satu tautan elegan, tanpa batas kompresi, dan tanpa daftar untuk penerima.";

export const metadata: Metadata = {
  title: { absolute: LANDING_TITLE },
  description: LANDING_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Galeriku",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    url: "/",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Galeriku — simpan foto perjalananmu dan kirim satu link",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

// Landing statis (prerender saat build), Server Component, tanpa JS klien.
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <RulesSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
