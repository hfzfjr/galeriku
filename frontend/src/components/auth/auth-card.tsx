import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/landing/logo";

/**
 * Cangkang kartu tunggal layar auth (DESIGN.md §7): wordmark di atas,
 * kartu di tengah. Server Component.
 */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-8">
      <Link
        href="/"
        aria-label="Galeriku, kembali ke beranda"
        className="flex min-h-11 items-center rounded-md"
      >
        <Logo />
      </Link>
      <section
        aria-labelledby="auth-title"
        className="w-full rounded-lg border border-line bg-surface p-4 sm:p-6"
      >
        <h1 id="auth-title" className="text-h1 text-ink">
          {title}
        </h1>
        {description ? (
          <div className="mt-2 text-body text-ink-muted">{description}</div>
        ) : null}
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
