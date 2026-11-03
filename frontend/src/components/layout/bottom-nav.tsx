"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Album,
  Camera,
  Cloud,
  Film,
  LayoutGrid,
  Link2,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
  filter?: "foto" | "video";
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const DESKTOP_SECTIONS: NavSection[] = [
  {
    title: "KOLEKSI",
    items: [
      { id: "semua", label: "Semua Media", href: "/galeri", icon: LayoutGrid, exact: true },
      { id: "foto", label: "Foto", href: "/galeri?filter=foto", icon: Camera, filter: "foto" },
      { id: "video", label: "Video", href: "/galeri?filter=video", icon: Film, filter: "video" },
      { id: "favorit", label: "Favorit", href: "/favorit", icon: Star },
      { id: "album", label: "Album", href: "/album", icon: Album },
    ],
  },
  {
    title: "BERBAGI",
    items: [
      { id: "shares", label: "Tautan Berbagi", href: "/shares", icon: Link2 },
    ],
  },
  {
    title: "LAINNYA",
    items: [
      { id: "sampah", label: "Sampah", href: "/sampah", icon: Trash2 },
      { id: "settings", label: "Akun", href: "/settings", icon: UserRound },
    ],
  },
];

const MOBILE_TABS: NavItem[] = [
  { id: "galeri", label: "Galeri", href: "/galeri", icon: LayoutGrid, exact: true },
  { id: "favorit", label: "Favorit", href: "/favorit", icon: Star },
  { id: "album", label: "Album", href: "/album", icon: Album },
  { id: "shares", label: "Link", href: "/shares", icon: Link2 },
  { id: "settings", label: "Akun", href: "/settings", icon: UserRound },
];

export type BottomNavProps = {
  /** Menimpa penentuan rute aktif (dipakai pratinjau /dev/ui). */
  activeRoute?: string;
  className?: string;
};

function isItemActive(
  item: NavItem,
  pathname: string | null,
  currentFilter: string | null,
): boolean {
  if (!pathname) return false;
  if (item.filter) {
    return pathname === "/galeri" && currentFilter === item.filter;
  }
  if (item.href === "/galeri") {
    return pathname === "/galeri" && !currentFilter;
  }
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
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

function BottomNavContent({ activeRoute, className }: BottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = activeRoute ?? pathname;
  const currentFilter = searchParams.get("filter");
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

      {/* Navigasi Desktop: Berkelompok ala Cloud Storage Modern */}
      <div className="hidden lg:flex flex-col gap-6 px-3">
        {DESKTOP_SECTIONS.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <span className="px-3 text-[11px] font-semibold tracking-wider text-ink-muted/70">
              {section.title}
            </span>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isItemActive(item, currentPath, currentFilter);
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-label transition-colors",
                        active
                          ? "bg-accent-soft/50 font-semibold text-accent"
                          : "text-ink-muted hover:bg-sunken/40 hover:text-ink",
                      )}
                    >
                      <Icon size={18} strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Navigasi Bar Bawah Mobile: 5 Tab Sentuh Ramping */}
      <ul className="flex items-stretch lg:hidden">
        {MOBILE_TABS.map((tab) => {
          const active = isItemActive(tab, currentPath, currentFilter);
          const Icon = tab.icon;
          return (
            <li key={tab.id} className="flex flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-1 px-1 pb-safe pt-2 transition-colors",
                  active ? "text-accent" : "text-ink-muted",
                )}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
                <span
                  className={cn(
                    "text-[11px] leading-none",
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

      {/* Bar Penyimpanan Ala Google Drive (Khusus Desktop) */}
      {session.data ? (
        <div className="hidden lg:flex flex-col gap-2 mt-auto px-4 pt-5 border-t border-line">
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

export function BottomNav(props: BottomNavProps) {
  return (
    <Suspense fallback={<nav aria-label="Navigasi utama" className="border-t border-line bg-surface lg:w-60 lg:shrink-0" />}>
      <BottomNavContent {...props} />
    </Suspense>
  );
}
