import { Suspense } from "react";
import type { Metadata } from "next";
import { GalleryGrid } from "@/components/gallery/gallery-grid";

export const metadata: Metadata = {
  title: "Favorit",
};

export const instant = false;

export default function FavoritPage() {
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-h1 text-ink">Favorit</h1>
        <p className="text-body text-ink-muted">
          Kumpulan foto dan video pilihan yang kamu tandai dengan bintang.
        </p>
      </div>

      <Suspense fallback={<div className="h-20 animate-pulse rounded bg-sunken/40" />}>
        <GalleryGrid
          favoriteOnly
          emptyTitle="Belum ada favorit"
          emptyDescription="Buka foto atau video apa saja lalu tekan tombol bintang untuk menambahkannya ke favorit."
        />
      </Suspense>
    </main>
  );
}

