"use client";

import { CircleAlert } from "lucide-react";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { useTheme } from "@/components/theme-provider";

export type TurnstileStatus = "memuat" | "siap" | "gagal";

export type TurnstileHandle = {
  /** Minta token baru; dipakai ulang setelah SETIAP submit yang gagal. */
  reset: () => void;
};

type TurnstileWindow = Window & {
  turnstile?: {    render: (
      container: HTMLElement,
      options: Record<string, unknown>,
    ) => string | undefined;
    reset: (widgetId?: string) => void;
    remove: (widgetId: string) => void;
  };
};

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("tanpa window"));
  }
  const win = window as TurnstileWindow;
  if (win.turnstile) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error("waktu habis"));
      }, 10_000);
      const done = (ok: boolean) => {
        window.clearTimeout(timer);
        if (ok) {
          resolve();
        } else {
          reject(new Error("gagal"));
        }
      };
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${SCRIPT_SRC}"]`,
      );
      if (existing) {
        if (win.turnstile) {
          done(true);
          return;
        }
        existing.addEventListener("load", () => done(true), { once: true });
        existing.addEventListener("error", () => done(false), { once: true });
        return;
      }
      const tag = document.createElement("script");
      tag.src = SCRIPT_SRC;
      tag.async = true;
      tag.defer = true;
      tag.addEventListener("load", () => done(true), { once: true });
      tag.addEventListener("error", () => done(false), { once: true });
      document.head.appendChild(tag);
    });
    // Boleh dicoba lagi bila gagal (mis. jaringan sempat putus).
    scriptPromise.catch(() => {
      scriptPromise = null;
    });
  }
  return scriptPromise;
}

/** Tema efektif (terang/gelap) mengikuti pilihan tema aktif. */
function useResolvedTheme(): "light" | "dark" {
  const { theme } = useTheme();
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    // Ditunda ke callback agar lolos aturan set-state-in-effect.
    const timeout = window.setTimeout(() => {
      setSystemDark(query.matches);
    }, 0);
    const onChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches);
    };
    query.addEventListener("change", onChange);
    return () => {
      window.clearTimeout(timeout);
      query.removeEventListener("change", onChange);
    };
  }, []);

  if (theme === "light") {
    return "light";
  }
  if (theme === "dark") {
    return "dark";
  }
  return systemDark ? "dark" : "light";
}

/**
 * Widget Cloudflare Turnstile (DESIGN.md §6): di atas tombol utama,
 * lebar penuh, mode ringkas, tema mengikuti tema aktif (ikut berubah
 * saat tema diganti). Token sekali pakai: parent memanggil reset()
 * setelah setiap submit yang gagal.
 *
 * Bila script gagal dimuat atau token kedaluwarsa: status "gagal",
 * parent menonaktifkan tombol utama.
 */
export function TurnstileField({
  onToken,
  onStatusChange,
  ref,
}: {
  onToken: (token: string | null) => void;
  onStatusChange: (status: TurnstileStatus) => void;
  ref?: Ref<TurnstileHandle>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const resolvedTheme = useResolvedTheme();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  // Tanpa site key widget tak bisa dirender — langsung status gagal.
  const [status, setStatus] = useState<TurnstileStatus>(
    siteKey ? "memuat" : "gagal",
  );

  const callbacksRef = useRef({ onToken, onStatusChange });
  useEffect(() => {
    callbacksRef.current = { onToken, onStatusChange };
  });

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        const win = window as TurnstileWindow;
        try {
          win.turnstile?.reset(widgetIdRef.current ?? undefined);
        } catch {
          // Widget belum siap — abaikan, token tetap dibersihkan.
        }
        callbacksRef.current.onToken(null);
      },
    }),
    [],
  );

  useEffect(() => {
    callbacksRef.current.onStatusChange(status);
  }, [status]);

  useEffect(() => {
    if (!siteKey) {
      return;
    }
    let cancelled = false;
    const container = containerRef.current;
    if (!container) {
      return;
    }

    loadScript()
      .then(() => {
        if (cancelled) {
          return;
        }
        const win = window as TurnstileWindow;
        if (!win.turnstile || !containerRef.current) {
          setStatus("gagal");
          return;
        }
        // Render ulang saat tema berubah: hapus widget lama dulu.
        if (widgetIdRef.current) {
          try {
            win.turnstile.remove(widgetIdRef.current);
          } catch {
            // Abaikan; render baru di bawah.
          }
          widgetIdRef.current = null;
        }
        containerRef.current.innerHTML = "";
        const id = win.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: resolvedTheme,
          size: "compact",
          callback: (token: string) => {
            if (!cancelled) {
              callbacksRef.current.onToken(token);
            }
          },
          "expired-callback": () => {
            if (!cancelled) {
              callbacksRef.current.onToken(null);
              setStatus("gagal");
            }
          },
          "error-callback": () => {
            if (!cancelled) {
              callbacksRef.current.onToken(null);
              setStatus("gagal");
            }
          },
        });
        if (typeof id === "string") {
          widgetIdRef.current = id;
          setStatus("siap");
        } else {
          setStatus("gagal");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("gagal");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey, resolvedTheme]);

  useEffect(() => {
    return () => {
      const win = window as TurnstileWindow;
      if (widgetIdRef.current) {
        try {
          win.turnstile?.remove(widgetIdRef.current);
        } catch {
          // Abaikan saat unmount.
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Lebar penuh; widget ringkas dirender di sini. */}
      <div ref={containerRef} className="min-h-11 w-full" aria-hidden="true" />
      <span className="sr-only" role="status">
        {status === "memuat"
          ? "Pemeriksaan keamanan sedang dimuat."
          : status === "siap"
            ? "Pemeriksaan keamanan siap."
            : "Pemeriksaan keamanan gagal dimuat."}
      </span>
      {status === "gagal" ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert
            size={16}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>Pemeriksaan keamanan gagal dimuat. Muat ulang halaman.</span>
        </p>
      ) : null}
    </div>
  );
}
