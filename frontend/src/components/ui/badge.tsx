import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type BadgeVariant = "accent" | "neutral" | "success" | "warning" | "danger";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  icon?: LucideIcon;
};

const variantClasses: Record<BadgeVariant, string> = {
  accent: "bg-accent-soft text-accent",
  neutral: "bg-sunken text-ink-muted",
  success: "bg-sunken text-success",
  warning: "bg-sunken text-warning",
  danger: "bg-sunken text-danger",
};

/**
 * Badge/chip Galeriku (DESIGN.md §6): tinggi 24, radius sm.
 * Status selalu ikon + teks, tidak mengandalkan warna saja.
 */
export function Badge({
  variant = "accent",
  icon: Icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-h-6 items-center gap-1 rounded-sm px-2 text-caption",
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {Icon ? (
        <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
