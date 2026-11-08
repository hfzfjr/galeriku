import { Suspense } from "react";
import type { Metadata } from "next";
import { GaleriUploadClient } from "./galeri-upload-client";

export const metadata: Metadata = {
  title: "Galeri",
};

export const instant = false;

export default function GaleriPage() {
  return (
    <main className="flex flex-col gap-4">
      <Suspense fallback={<div className="h-20 animate-pulse rounded bg-sunken/40" />}>
        <GaleriUploadClient />
      </Suspense>
    </main>
  );
}
