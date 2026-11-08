import type { Metadata } from "next";
import { Suspense, use } from "react";
import type { PublicShareMetaResponse } from "@galeriku/contracts";
import { PublicShareClient } from "./public-share-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  try {
    const res = await fetch(`${apiUrl}/public/s/${token}/meta`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        title: "Tautan Berbagi — Galeriku",
        robots: { index: false, follow: false },
      };
    }

    const meta: PublicShareMetaResponse = await res.json();

    if (meta.status === "PASSWORD_PROTECTED") {
      return {
        title: "Tautan Dilindungi Sandi — Galeriku",
        description: "Masukkan kata sandi untuk melihat konten yang dibagikan.",
        robots: { index: false, follow: false },
      };
    }

    if (meta.status === "EXPIRED") {
      return {
        title: "Tautan Kedaluwarsa — Galeriku",
        description: "Tautan ini telah kedaluwarsa.",
        robots: { index: false, follow: false },
      };
    }

    if (meta.status === "REVOKED") {
      return {
        title: "Tautan Dicabut — Galeriku",
        description: "Tautan ini telah dicabut oleh pemiliknya.",
        robots: { index: false, follow: false },
      };
    }

    const title = `${meta.title} — Galeriku`;
    const descParts: string[] = [];
    if (meta.ownerName) {
      descParts.push(`Dibagikan oleh ${meta.ownerName}`);
    }
    if (meta.fileCount > 0) {
      descParts.push(`${meta.fileCount} item`);
    }
    const description =
      descParts.length > 0
        ? descParts.join(" · ")
        : "Lihat foto dan video di Galeriku.";

    const ogImages = meta.hasCover
      ? [`${apiUrl}/public/s/${token}/cover`]
      : [];

    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: {
        title,
        description,
        images: ogImages,
      },
    };
  } catch {
    return {
      title: "Tautan Berbagi — Galeriku",
      robots: { index: false, follow: false },
    };
  }
}

function PublicShareContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <PublicShareClient token={token} />;
}

export default function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg p-8 flex flex-col gap-6 animate-pulse">
          <div className="h-8 w-40 rounded bg-sunken" />
          <div className="h-10 w-72 rounded bg-sunken" />
        </div>
      }
    >
      <PublicShareContent params={params} />
    </Suspense>
  );
}
