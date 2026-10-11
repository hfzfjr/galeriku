"use client";

import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import {
  getButtonClassName,
  type ButtonVariant,
} from "./button-styles";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
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
      className={getButtonClassName(variant, className)}
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
