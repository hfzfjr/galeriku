import type { Metadata } from "next";
import { GaleriUploadClient } from "./galeri-upload-client";

export const metadata: Metadata = {
  title: "Galeri",
};

export default function GaleriPage() {
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-h1 text-ink">Galeri</h1>
        <p className="text-body text-ink-muted">
          Pilih foto atau video dari HP-mu. Upload berlanjut otomatis kalau
          sinyal putus.
        </p>
      </div>
      <GaleriUploadClient />
    </main>
  );
}
