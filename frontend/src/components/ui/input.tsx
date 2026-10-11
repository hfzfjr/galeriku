"use client";

import { CircleAlert } from "lucide-react";
import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

/**
 * Input teks Galeriku (DESIGN.md §6). Label di atas, tinggi 48, teks 16px
 * agar iOS tidak zoom otomatis. Fokus: ring 2px accent offset 2px.
 * Error: border danger + pesan berikon di bawah, terhubung via aria-describedby.
 */
export function Input({
  label,
  error,
  hint,
  id,
  className,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? `input-${autoId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = error
    ? errorId
    : hint
      ? hintId
      : undefined;

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={inputId} className="text-label text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 w-full rounded-md border bg-surface px-4 text-base text-ink placeholder:text-ink-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
          error ? "border-danger" : "border-line",
          "disabled:cursor-default disabled:opacity-45",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert
            size={16}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
