import type { Metadata } from "next";
import { SharesClient } from "./shares-client";

export const metadata: Metadata = {
  title: "Tautan Berbagi",
};

export default function SharesPage() {
  return <SharesClient />;
}
