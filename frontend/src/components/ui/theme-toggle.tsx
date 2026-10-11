"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/cn";
import type { ThemeChoice } from "@/components/theme";

const OPTIONS: Array<{
  value: ThemeChoice;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "auto", label: "Otomatis", icon: Monitor },
];

/**
 * Kontrol tema manual: Terang / Gelap / Otomatis.
 * Pilihan disimpan di localStorage; Otomatis menghapus data-theme
 * sehingga CSS mengikuti prefers-color-scheme.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Pilih tema tampilan"
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-md border border-line bg-surface p-1",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-sm px-3 text-label",
              "transition-colors duration-150 ease-out",
              active
                ? "bg-accent-soft font-semibold text-accent"
                : "text-ink-muted",
            )}
          >
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
