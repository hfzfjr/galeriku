"use client";

import { CircleAlert } from "lucide-react";
import { useState, type Ref } from "react";
import { cn } from "@/lib/cn";

const CODE_LENGTH = 6;

/**
 * Input kode OTP (DESIGN.md §6): SATU input teks sungguhan yang
 * ditampilkan sebagai 6 sel. inputmode numeric, autocomplete
 * one-time-code (isian otomatis dari email), maxlength 6, mendukung
 * tempel (paste). Error: border semua sel danger + pesan berikon.
 *
 * Sel memakai lebar lentur (bukan 48px tetap) agar muat tanpa scroll
 * horizontal di 360px di dalam kartu ber-padding.
 */
export function OtpInput({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  ref,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(0);
  const errorId = `${id}-error`;

  const digits = value.slice(0, CODE_LENGTH).split("");
  const activeIndex =
    caret < CODE_LENGTH ? caret : CODE_LENGTH - 1;

  function handleChange(next: string): void {
    const cleaned = next.replace(/\D/g, "").slice(0, CODE_LENGTH);
    onChange(cleaned);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Input sungguhan: tersembunyi visual tapi tetap bisa difokus,
          menerima keyboard, tempel, dan isian otomatis. */}
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        value={value}
        onChange={(event) => {
          handleChange(event.target.value);
          setCaret(event.target.selectionStart ?? event.target.value.length);
        }}
        onSelect={(event) => {
          setCaret(event.currentTarget.selectionStart ?? 0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="sr-only"
      />
      {/* Tampilan 6 sel: mengklik di mana saja memfokuskan input. */}
      <div
        role="presentation"
        aria-hidden="true"
        onClick={() => {
          // Fokus lewat ref tidak tersedia di sini; klik teruskan ke input
          // lewat id (tanpa useRef tambahan agar komponen tetap ringan).
          document.getElementById(id)?.focus({ preventScroll: true });
        }}
        className="flex w-full cursor-text gap-2"
      >
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const filled = digits[index] !== undefined;
          const active = focused && index === activeIndex && !disabled;
          return (
            <span
              key={index}
              className={cn(
                "flex h-14 min-w-0 flex-1 items-center justify-center rounded-md border bg-surface font-serif text-[28px] font-semibold leading-none text-ink",
                error ? "border-danger" : "border-line",
                active &&
                  "outline-none ring-2 ring-accent ring-offset-2 ring-offset-paper",
              )}
            >
              {filled ? digits[index] : ""}
            </span>
          );
        })}
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
      ) : null}
    </div>
  );
}

/** Label terlihat untuk OtpInput (label di atas, bukan placeholder). */
export function OtpLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="text-label text-ink">
      {children}
    </label>
  );
}
