"use client";

import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent active:bg-accent-hover",
  secondary: "border border-ink bg-transparent text-ink active:bg-sunken",
  ghost: "bg-transparent text-ink active:bg-sunken",
  danger: "bg-danger text-on-accent active:opacity-90 active:scale-[0.98]",
};

/**
 * Tombol Galeriku (DESIGN.md §6). Tinggi 48, radius md, label semibold.
 * Status loading menampilkan spinner Lucide, label tetap, aria-busy,
 * dan tidak bisa diklik ganda.
 */
export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex h-12 min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-6 text-base font-semibold",
        "transition-[background-color,transform,opacity] duration-150 ease-out motion-safe:active:scale-[0.98]",
        "disabled:cursor-default disabled:opacity-45",
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <LoaderCircle
          size={20}
          strokeWidth={1.5}
          className="shrink-0 motion-safe:animate-spin"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}
