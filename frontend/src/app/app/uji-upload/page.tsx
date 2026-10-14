import type { Metadata } from "next";
import { UjiUploadClient } from "./uji-upload-client";

// SEMENTARA (US-16): halaman uji manual, dihapus di US-17.
// Login diwajibkan pembungkus /app (AppShell); noindex dari layout /app.
export const metadata: Metadata = {
  title: "Uji Upload",
};

export default function UjiUploadPage() {
  return <UjiUploadClient />;
}
