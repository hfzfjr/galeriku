"use client";

import { useEffect, useState } from "react";

/**
 * Email yang sedang diverifikasi/direset disimpan di sessionStorage
 * (bukan query URL), bersama waktu kirim terakhir agar hitung mundur
 * 60 detik tidak reset saat refresh. Aman dipanggil saat SSR.
 */

export type PendingEmail = {
  email: string;
  /** Waktu kirim terakhir (epoch ms) untuk hitung mundur kirim ulang. */
  sentAt: number;
  /** True bila tiba dari jalur login (perlu resend-code sekali). */
  fromLogin?: boolean;
};

const VERIFY_KEY = "galeriku:verify-email";
const RESET_KEY = "galeriku:reset-email";

function readKey(key: string): PendingEmail | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PendingEmail>;
    if (typeof parsed.email !== "string" || parsed.email.length === 0) {
      return null;
    }
    return {
      email: parsed.email,
      sentAt: typeof parsed.sentAt === "number" ? parsed.sentAt : 0,
      fromLogin: parsed.fromLogin === true,
    };
  } catch {
    return null;
  }
}

function writeKey(key: string, value: PendingEmail): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Penyimpanan penuh/tidak tersedia — alur tetap jalan sesi ini.
  }
}

function clearKey(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Abaikan.
  }
}

export function getVerifyEmail(): PendingEmail | null {
  return readKey(VERIFY_KEY);
}

export function saveVerifyEmail(value: PendingEmail): void {
  writeKey(VERIFY_KEY, value);
}

export function clearVerifyEmail(): void {
  clearKey(VERIFY_KEY);
}

export function getResetEmail(): PendingEmail | null {
  return readKey(RESET_KEY);
}

export function saveResetEmail(value: PendingEmail): void {
  writeKey(RESET_KEY, value);
}

export function clearResetEmail(): void {
  clearKey(RESET_KEY);
}

/** Jeda kirim ulang OTP 60 detik (mengikuti RESEND_WINDOW_MS backend). */
export const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Hitung mundur dari sentAt. Berjalan di klien saja; di server
 * mengembalikan sisa penuh agar render pertama stabil.
 */
export function useResendCountdown(sentAt: number): number {
  const [now, setNow] = useState<number>(() =>
    typeof window === "undefined" ? sentAt : Date.now(),
  );

  useEffect(() => {
    // Ditunda ke callback agar lolos aturan set-state-in-effect
    // (pola yang sama dengan ThemeProvider).
    const timeout = window.setTimeout(() => {
      setNow(Date.now());
    }, 0);
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(id);
    };
  }, [sentAt]);

  const remaining = Math.ceil((sentAt + RESEND_COOLDOWN_MS - now) / 1000);
  return remaining > 0 ? remaining : 0;
}
