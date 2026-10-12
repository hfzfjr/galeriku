import type { Metadata } from "next";
import { AppPlaceholder } from "@/components/app/app-placeholder";

export const metadata: Metadata = {
  title: "Link",
};

// Placeholder minimal agar tab Link tidak 404 (fitur menyusul US-24).
export default function SharesPage() {
  return (
    <AppPlaceholder
      title="Link"
      message="Link berbagimu akan tampil di sini. Layar ini menyusul di story berikutnya."
    />
  );
}
