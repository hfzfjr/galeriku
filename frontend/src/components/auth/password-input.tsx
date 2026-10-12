"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string;
  hint?: string;
};

/**
 * Input password (DESIGN.md §6): gaya sama dengan Input (tinggi 48,
 * teks 16px, ring fokus accent), plus tombol tampil/sembunyi di dalam
 * (44px, aria-label Indonesia).
 */
export function PasswordInput({
  label,
  error,
  hint,
  id,
  className,
  disabled,
  ...rest
}: PasswordInputProps) {
  const autoId = useId();
  const inputId = id ?? `password-${autoId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={inputId} className="text-label text-ink">
        {label}
      </label>
      <div className="relative w-full">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          autoComplete={rest.autoComplete ?? "current-password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn(
            "h-12 w-full rounded-md border bg-surface py-0 pl-4 pr-12 text-base text-ink placeholder:text-ink-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
            error ? "border-danger" : "border-line",
            "disabled:cursor-default disabled:opacity-45",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 active:bg-sunken disabled:cursor-default disabled:opacity-45"
        >
          {visible ? (
            <EyeOff size={20} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Eye size={20} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm font-medium text-danger"
        >
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
