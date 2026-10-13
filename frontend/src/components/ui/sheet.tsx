"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
};

/**
 * Bottom sheet Galeriku (DESIGN.md §6): radius atas 20, handle 36×4,
 * latar surface, backdrop scrim, tombol menempel bawah dengan safe-area.
 * Dialog aksesibel: fokus masuk saat dibuka, Esc dan ketuk backdrop
 * menutup, fokus kembali ke pemicu. Tanpa dependency baru.
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    // Fokus ke panel (defer agar lolos aturan set-state-in-effect
    // tidak relevan di sini; fokus DOM langsung, bukan setState).
    const timeout = window.setTimeout(() => {
      const target = panel?.querySelector<HTMLElement>(
        "[data-autofocus]",
      );
      (target ?? panel)?.focus();
    }, 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const badan = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = badan;
      const opener = openerRef.current;
      if (opener instanceof HTMLElement) {
        opener.focus();
      }
    };
  }, [open, onClose]);

  // Fokus trap ringan: putar Tab di dalam panel.
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const fokus = [...panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((el) => el.offsetParent !== null);
    if (fokus.length === 0) {
      return;
    }
    const pertama = fokus[0];
    const terakhir = fokus[fokus.length - 1];
    if (event.shiftKey && document.activeElement === pertama) {
      event.preventDefault();
      terakhir.focus();
    } else if (!event.shiftKey && document.activeElement === terakhir) {
      event.preventDefault();
      pertama.focus();
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-scrim"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-[20px] bg-surface pb-safe shadow-float",
          className,
        )}
      >
        <div aria-hidden="true" className="flex justify-center pt-3">
          <span className="h-1 w-9 rounded-full bg-line" />
        </div>
        <div className="flex items-start justify-between gap-3 px-4 pt-2">
          <h2 id={titleId} className="text-h2 text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail"
            data-autofocus
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink transition-colors duration-150 active:bg-sunken"
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="px-4 pb-6 pt-2">{children}</div>
      </div>
    </div>
  );
}
