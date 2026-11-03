"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Album, Cloud, LayoutGrid, Link2, UserRound } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";

type Tab = {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
};

const TABS: Tab[] = [
  { id: "galeri", label: "Galeri", href: "/galeri", icon: LayoutGrid, exact: true },
  { id: "album", label: "Album", href: "/album", icon: Album },
  { id: "link", label: "Link", href: "/shares", icon: Link2 },
  { id: "akun", label: "Akun", href: "/settings", icon: UserRound },
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

function formatBytes(bytesStr?: string): string {
  if (!bytesStr) return "0 B";
  try {
    const bytes = Number(BigInt(bytesStr));
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return `${val < 10 && i > 0 ? val.toFixed(1) : Math.round(val)} ${sizes[i]}`;
  } catch {
    return "0 B";
  }
}

function calculateStoragePercentage(
  usedStr?: string,
  quotaStr?: string,
): { percent: number; usedNum: number } {
  if (!quotaStr) return { percent: 0, usedNum: 0 };
  try {
    const quota = Number(BigInt(quotaStr));
    if (quota <= 0) return { percent: 0, usedNum: 0 };
    const used = usedStr ? Number(BigInt(usedStr)) : 0;
    const pct = Math.min(100, Math.max(0, Math.round((used / quota) * 100)));
    return { percent: pct, usedNum: used };
  } catch {
    return { percent: 0, usedNum: 0 };
  }
}

/**
 * Navigasi bawah area aplikasi (DESIGN.md §6): 4 tab, tinggi 56 + safe-area,
 * latar surface, garis atas line. Tab aktif memakai accent + label 600.
 * Di ≥1024px menjadi sidebar kiri sticky dengan logo dan info penyimpanan.
 */
export function BottomNav({ activeRoute, className }: BottomNavProps) {
  const pathname = usePathname();
  const current = activeRoute ?? pathname;
  const session = useSession();

  const quotaBytes = session.data?.quotaBytes;
  const usedBytes = session.data?.usedBytes ?? "0";
  const { percent: storagePercent, usedNum } = calculateStoragePercentage(
    usedBytes,
    quotaBytes,
  );

  return (
    <nav
      aria-label="Navigasi utama"
      className={cn(
        "border-t border-line bg-surface",
        "lg:flex lg:h-full lg:w-60 lg:shrink-0 lg:flex-col lg:border-t-0 lg:border-r lg:py-6 lg:overflow-y-auto",
        className,
      )}
    >
      {/* Brand Header Desktop */}
      <div className="hidden lg:flex items-center px-4 pb-6">
        <Link
          href="/galeri"
          aria-label="Galeriku, ke galeri"
          className="flex items-center rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Logo small />
        </Link>
      </div>

      {/* Navigasi Menu */}
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
                  "flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-1 px-2 pb-safe pt-2 transition-colors",
                  "lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-lg lg:px-3 lg:pb-2.5 lg:pt-2.5",
                  active
                    ? "text-accent lg:bg-accent-soft/40 font-medium"
                    : "text-ink-muted hover:text-ink hover:bg-sunken/40",
                )}
              >
                <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                <span
                  className={cn(
                    "text-caption leading-none",
                    "lg:text-label",
                    active && "font-semibold text-accent",
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bar Penyimpanan Ala Google Drive (Khusus Desktop) */}
      {session.data ? (
        <div className="hidden lg:flex flex-col gap-2.5 mt-auto px-4 pt-5 border-t border-line">
          <div className="flex items-center gap-2">
            <Cloud size={16} strokeWidth={1.75} className="text-accent shrink-0" />
            <span className="text-caption font-medium text-ink">Penyimpanan</span>
            <span className="ml-auto text-caption font-semibold text-ink-muted">
              {storagePercent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={storagePercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Kapasitas penyimpanan terpakai"
            className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                storagePercent > 90
                  ? "bg-danger"
                  : storagePercent > 75
                  ? "bg-warning"
                  : "bg-accent",
              )}
              style={{
                width: `${Math.max(storagePercent, usedNum > 0 ? 3 : 0)}%`,
              }}
            />
          </div>
          <p className="text-[12px] text-ink-muted leading-tight">
            {formatBytes(usedBytes)} dari {formatBytes(quotaBytes)} terpakai
          </p>
        </div>
      ) : null}
    </nav>
  );
}
