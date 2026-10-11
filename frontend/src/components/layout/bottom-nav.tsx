"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Album, LayoutGrid, Link2, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

type Tab = {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
};

const TABS: Tab[] = [
  { id: "galeri", label: "Galeri", href: "/app", icon: LayoutGrid, exact: true },
  { id: "album", label: "Album", href: "/app/albums", icon: Album },
  { id: "link", label: "Link", href: "/app/shares", icon: Link2 },
  { id: "akun", label: "Akun", href: "/app/settings", icon: UserRound },
];

export type BottomNavProps = {
  /** Menimpa penentuan tab aktif (dipakai pratinjau /dev/ui). */
  activeRoute?: string;
  className?: string;
};

function isTabActive(tab: Tab, route: string | null): boolean {
  if (!route) return false;
  if (tab.exact) return route === tab.href;
  return route === tab.href || route.startsWith(`${tab.href}/`);
}

/**
 * Navigasi bawah area /app (DESIGN.md §6): 4 tab, tinggi 56 + safe-area,
 * latar surface, garis atas line. Tab aktif memakai accent + label 600.
 * Komponen ini tidak mengunci position (fixed/sticky diatur lewat
 * className/wrapper oleh pemakai). Di ≥1024px menjadi sidebar kiri 240px.
 */
export function BottomNav({ activeRoute, className }: BottomNavProps) {
  const pathname = usePathname();
  const current = activeRoute ?? pathname;

  return (
    <nav
      aria-label="Navigasi utama"
      className={cn(
        "border-t border-line bg-surface",
        "lg:flex lg:h-full lg:w-60 lg:shrink-0 lg:flex-col lg:border-t-0 lg:border-r lg:py-6",
        className,
      )}
    >
      <ul
        className={cn(
          "flex items-stretch",
          "lg:flex-col lg:items-stretch lg:gap-1 lg:px-3",
        )}
      >
        {TABS.map((tab) => {
          const active = isTabActive(tab, current);
          const Icon = tab.icon;
          return (
            <li key={tab.id} className="flex flex-1 lg:flex-none">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-1 px-2 pb-safe pt-2",
                  "lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-4 lg:pb-2 lg:pt-2",
                  active ? "text-accent" : "text-ink-muted",
                )}
              >
                <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                <span
                  className={cn(
                    "text-caption leading-none",
                    "lg:text-label",
                    active && "font-semibold",
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
