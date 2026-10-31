import type { Metadata } from "next";
import { Suspense, use } from "react";
import { PublicShareClient } from "./public-share-client";

export const metadata: Metadata = {
  title: "Tautan Berbagi — Galeriku",
  robots: {
    index: false,
    follow: false,
  },
};

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

