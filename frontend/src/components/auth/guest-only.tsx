"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { AuthCard } from "./auth-card";
import { ServiceDown } from "./service-down";
import { Button } from "@/components/ui/button";
import { isServiceDown } from "@/lib/auth-errors";
import { useSession } from "@/lib/session";

/** Kerangka netral selagi status sesi dimuat (tanpa kedip konten). */
export function AuthLoadingSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Memuat halaman"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-8"
    >
      <div className="h-9 w-36 animate-pulse rounded-md bg-sunken" />
      <div className="w-full rounded-lg border border-line bg-surface p-4 sm:p-6">
        <div className="h-8 w-40 animate-pulse rounded-md bg-sunken" />
        <div className="mt-6 flex flex-col gap-4">
          <div className="h-12 w-full animate-pulse rounded-md bg-sunken" />
          <div className="h-12 w-full animate-pulse rounded-md bg-sunken" />
          <div className="h-12 w-full animate-pulse rounded-md bg-sunken" />
        </div>
      </div>
    </main>
  );
}

/**
 * Pembungkus layar auth: pengguna yang sudah login dialihkan ke /app
 * berdasar /auth/me. Gagal jaringan/5xx menampilkan layar
 * "Galeriku lagi istirahat" (dengan "Coba lagi").
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.data) {
      router.replace("/app");
    }
  }, [session.data, router]);

  if (session.isPending) {
    return <AuthLoadingSkeleton />;
  }

  if (session.error) {
    if (isServiceDown(session.error)) {
      return <ServiceDown onRetry={() => session.refetch()} />;
    }
    return (
      <AuthCard title="Ada kendala">
        <div className="flex flex-col items-start gap-4">
          <p
            role="alert"
            className="flex items-start gap-1.5 text-body text-danger"
          >
            <CircleAlert
              size={20}
              strokeWidth={1.5}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span>Terjadi kesalahan. Muat ulang halaman lalu coba lagi.</span>
          </p>
          <Button variant="primary" onClick={() => session.refetch()}>
            Coba lagi
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (session.data) {
    // Sudah login, sedang dialihkan — jangan tampilkan form.
    return <AuthLoadingSkeleton />;
  }

  return <>{children}</>;
}
