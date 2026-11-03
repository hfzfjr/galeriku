import type { Metadata } from "next";
import { AlbumsClient } from "./albums-client";

export const metadata: Metadata = {
  title: "Album",
};

export default function AlbumsPage() {
  return <AlbumsClient />;
}
