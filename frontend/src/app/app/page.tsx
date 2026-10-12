import type { Metadata } from "next";
import { AppPlaceholder } from "@/components/app/app-placeholder";

export const metadata: Metadata = {
  title: "Galeri",
};

export default function GaleriPage() {
  return (
    <AppPlaceholder
      title="Galeri"
      message="Galeri fotomu akan tampil di sini. Layar ini menyusul di story berikutnya."
    />
  );
}
