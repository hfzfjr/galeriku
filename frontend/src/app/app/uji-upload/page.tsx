import type { Metadata } from "next";
import { UjiUploadClient } from "./uji-upload-client";

export const metadata: Metadata = {
  title: "Uji Upload",
};

export default function UjiUploadPage() {
  return <UjiUploadClient />;
}
