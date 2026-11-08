"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AlbumBreadcrumbItem } from "@galeriku/contracts";

interface AlbumBreadcrumbProps {
  items: AlbumBreadcrumbItem[];
  currentTitle: string;
}

export function AlbumBreadcrumb({ items, currentTitle }: AlbumBreadcrumbProps) {
  // Selalu sertakan akar "Semua Album" di awal
  const allSteps = [
    { id: "root", title: "Semua Album", href: "/album" },
    ...items.slice(0, -1).map((item) => ({
      id: item.id,
      title: item.title,
      href: `/album/${encodeURIComponent(item.id)}`,
    })),
  ];

  // Jika jalur panjang di HP, potong tengah dengan elipsis
  const isLong = allSteps.length > 3;
  const visibleSteps = isLong
    ? [allSteps[0], { id: "ellipsis", title: "...", href: null }, allSteps[allSteps.length - 1]]
    : allSteps;

  return (
    <nav aria-label="Navigasi remah roti album" className="overflow-x-auto py-1">
      <ol className="flex items-center gap-1.5 whitespace-nowrap text-caption">
        {visibleSteps.map((step, idx) => (
          <li key={step.id || idx} className="flex items-center gap-1.5">
            {idx > 0 && (
              <ChevronRight
                size={14}
                className="text-ink-muted/60 shrink-0"
                aria-hidden="true"
              />
            )}
            {step.href ? (
              <Link
                href={step.href}
                className="flex min-h-11 items-center rounded-md px-1.5 font-medium text-ink-muted transition hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="max-w-[120px] truncate sm:max-w-[180px]">
                  {step.title}
                </span>
              </Link>
            ) : (
              <span className="flex min-h-11 items-center px-1 font-medium text-ink-muted">
                {step.title}
              </span>
            )}
          </li>
        ))}

        {/* Item aktif saat ini */}
        <li className="flex items-center gap-1.5">
          <ChevronRight
            size={14}
            className="text-ink-muted/60 shrink-0"
            aria-hidden="true"
          />
          <span
            aria-current="page"
            className="flex min-h-11 items-center px-1.5 font-semibold text-ink"
          >
            <span className="max-w-[140px] truncate sm:max-w-[240px]">
              {currentTitle}
            </span>
          </span>
        </li>
      </ol>
    </nav>
  );
}
