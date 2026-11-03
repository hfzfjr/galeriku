import type { Metadata } from "next";
import { SampahClient } from "./sampah-client";

export const metadata: Metadata = {
  title: "Sampah",
};

export default function SampahPage() {
  return <SampahClient />;
}

