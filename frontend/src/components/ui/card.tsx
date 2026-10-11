import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLElement> & {
  heading?: string;
  description?: string;
};

/**
 * Kartu Galeriku: latar surface, garis 1px line, radius lg (16px).
 * Pemisah memakai garis, bukan bayangan (DESIGN.md §4).
 */
export function Card({
  heading,
  description,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <section
      className={cn("rounded-lg border border-line bg-surface p-4", className)}
      {...rest}
    >
      {heading ? <h3 className="text-h3 text-ink">{heading}</h3> : null}
      {description ? (
        <p className="mt-1 text-body text-ink-muted">{description}</p>
      ) : null}
      {children}
    </section>
  );
}
