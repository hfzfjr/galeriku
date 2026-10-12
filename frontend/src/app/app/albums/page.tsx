import type { Metadata } from "next";
import { AppPlaceholder } from "@/components/app/app-placeholder";

export const metadata: Metadata = {
  title: "Album",
};

// Placeholder minimal agar tab Album tidak 404 (fitur menyusul US-23).
export default function AlbumsPage() {
  return (
    <AppPlaceholder
      title="Album"
      message="Album fotomu akan tampil di sini. Layar ini menyusul di story berikutnya."
    />
  );
}
