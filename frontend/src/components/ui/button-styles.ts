import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_BASE_CLASSES =
  "inline-flex h-12 min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-6 text-base font-semibold no-underline transition-[background-color,transform,opacity] duration-150 ease-out motion-safe:active:scale-[0.98] disabled:cursor-default disabled:opacity-45";

const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent active:bg-accent-hover",
  secondary: "border border-ink bg-transparent text-ink active:bg-sunken",
  ghost: "bg-transparent text-ink active:bg-sunken",
  danger: "bg-danger text-on-accent active:opacity-90 active:scale-[0.98]",
};

/**
 * Kelas gaya tombol yang dipakai bersama oleh Button (<button>) dan
 * ButtonLink (<a>). API Button tidak berubah.
 */
export function getButtonClassName(
  variant: ButtonVariant = "primary",
  className?: string,
): string {
  return cn(
    BUTTON_BASE_CLASSES,
    BUTTON_VARIANT_CLASSES[variant],
    className,
  );
}
