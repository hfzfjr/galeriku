"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ServiceDown } from "@/components/auth/service-down";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { isServiceDown } from "@/lib/auth-errors";
import { useSession } from "@/lib/session";

/** Kerangka netral selagi sesi dimuat (tanpa kedip konten). */
function AppLoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat aplikasi" className="min-h-dvh">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4">
        <div className="h-8 w-32 animate-pulse rounded-md bg-sunken" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-sunken" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-sunken" />
      </div>
    </div>
  );
}

/**
 * Cangkang area /app (US-10): query /auth/me; 401 dialihkan ke /login;
 * gagal jaringan/5xx menampilkan "Galeriku lagi istirahat"; sukses
 * menampilkan BottomNav + children.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.data === null) {
      router.replace("/login");
    }
  }, [session.data, router]);

  if (session.isPending) {
    return <AppLoadingSkeleton />;
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

  if (!session.data) {
    // Belum login, sedang dialihkan — jangan tampilkan isi.
    return <AppLoadingSkeleton />;
  }

  return (
    <div className="min-h-dvh lg:flex">
      <div className="fixed inset-x-0 bottom-0 z-10 lg:static lg:z-auto">
        <BottomNav className="lg:min-h-dvh" />
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-4 lg:px-6 lg:pb-8">
        {children}
      </div>
    </div>
  );
}
