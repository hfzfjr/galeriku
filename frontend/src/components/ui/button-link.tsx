import type { AnchorHTMLAttributes } from "react";
import {
  getButtonClassName,
  type ButtonVariant,
} from "./button-styles";

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
};

/**
 * Tautan bergaya tombol (untuk landing: Masuk, Daftar). Memakai gaya
 * yang sama dengan Button lewat getButtonClassName. Server Component.
 */
export function ButtonLink({
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a className={getButtonClassName(variant, className)} {...rest}>
      {children}
    </a>
  );
}
