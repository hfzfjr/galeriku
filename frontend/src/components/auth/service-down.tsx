"use client";

import { MoonStar } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Layar "Galeriku lagi istirahat" (DESIGN.md §7, carry-over US-06).
 * Dipakai saat API tak terjangkau (server rumah mati). Tanpa kode HTTP
 * atau stack trace. Satu kalimat + tombol "Coba lagi".
 */
export function ServiceDown({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <MoonStar
        size={64}
        strokeWidth={1.5}
        className="text-ink-muted"
        aria-hidden="true"
      />
      <h1 className="text-h1 text-ink">Galeriku lagi istirahat</h1>
      <p className="text-body text-ink-muted">
        Server sedang tidak bisa dihubungi. Coba lagi sebentar lagi.
      </p>
      <Button variant="primary" onClick={onRetry} className="mt-2 w-full">
        Coba lagi
      </Button>
    </main>
  );
}
