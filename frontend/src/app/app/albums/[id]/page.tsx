import type { Metadata } from "next";
import { AlbumDetailClient } from "./album-detail-client";

export const metadata: Metadata = {
  title: "Detail Album",
};

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AlbumDetailClient albumId={id} />;
}

