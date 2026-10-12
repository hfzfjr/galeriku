"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormInfo } from "@/components/auth/form-message";
import { GuestOnly } from "@/components/auth/guest-only";
import { OtpInput, OtpLabel } from "@/components/auth/otp-input";
import { AuthLoadingSkeleton } from "@/components/auth/guest-only";
import { Button } from "@/components/ui/button";
import { resendCode, verifyEmail } from "@/lib/api";
import { toIndonesianMessage } from "@/lib/auth-errors";
import {
  getVerifyEmail,
  saveVerifyEmail,
  clearVerifyEmail,
  useResendCountdown,
  type PendingEmail,
} from "@/lib/pending-email";
import { ME_QUERY_KEY } from "@/lib/session";

export function VerifyEmailForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<PendingEmail | null>(null);
  const [ready, setReady] = useState(false);
  const [arrivedFromLogin, setArrivedFromLogin] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resendAttempted = useRef(false);
  const remaining = useResendCountdown(sentAt);

  useEffect(() => {
    // Ditunda ke callback agar lolos aturan set-state-in-effect dan
    // render pertama sama dengan SSR (pola yang sama dengan ThemeProvider).
    const timeout = window.setTimeout(() => {
      const stored = getVerifyEmail();
      if (!stored) {
        router.replace("/login");
        return;
      }
      setAccount(stored);
      setSentAt(stored.sentAt);
      setReady(true);
      if (stored.fromLogin) {
        setArrivedFromLogin(true);
        saveVerifyEmail({ email: stored.email, sentAt: stored.sentAt });
        // Temuan backend: login akun belum terverifikasi TIDAK mengirim
        // OTP baru, jadi minta sekali di sini. 202/429 ditangani ramah.
        if (!resendAttempted.current) {
          resendAttempted.current = true;
          resendCode({ email: stored.email })
            .then(() => {
              const now = Date.now();
              setSentAt(now);
              saveVerifyEmail({ email: stored.email, sentAt: now });
            })
            .catch((requestError) => {
              setError(toIndonesianMessage(requestError));
            });
        }
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !account) {
      return;
    }
    setError(null);
    setNotice(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Masukkan 6 digit kode.");
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const me = await verifyEmail({ email: account.email, code });
      // Sesi sudah dibuat backend; isi cache /auth/me lalu ke /app.
      clearVerifyEmail();
      queryClient.setQueryData(ME_QUERY_KEY, me);
      router.replace("/app");
    } catch (requestError) {
      setCode("");
      setError(toIndonesianMessage(requestError));
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending || remaining > 0 || !account) {
      return;
    }
    setResending(true);
    setError(null);
    try {
      await resendCode({ email: account.email });
      const now = Date.now();
      setSentAt(now);
      saveVerifyEmail({ email: account.email, sentAt: now });
      setNotice(`Kode baru sudah dikirim ke ${account.email}.`);
    } catch (requestError) {
      setError(toIndonesianMessage(requestError));
    } finally {
      setResending(false);
    }
  }

  if (!ready || !account) {
    return <AuthLoadingSkeleton />;
  }

  return (
    <GuestOnly>
      <AuthCard
        title="Cek email kamu"
        description={
          <>
            Kami mengirim kode 6 digit ke <strong>{account.email}</strong>.
            Kode berlaku 10 menit.
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {arrivedFromLogin ? (
            <FormInfo message="Email kamu belum diverifikasi. Masukkan kode yang kami kirim." />
          ) : null}
          {notice ? <FormInfo message={notice} /> : null}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <OtpLabel htmlFor="kode-otp">Kode verifikasi</OtpLabel>
              <OtpInput
                ref={inputRef}
                id="kode-otp"
                label="Kode verifikasi"
                value={code}
                onChange={(next) => {
                  setCode(next);
                  if (error) {
                    setError(null);
                  }
                }}
                error={error ?? undefined}
                disabled={submitting}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              className="w-full"
            >
              Verifikasi
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            disabled={remaining > 0 || resending || submitting}
            onClick={handleResend}
            className="w-full"
          >
            {remaining > 0 ? (
              <>
                Kirim ulang kode{" "}
                <span aria-hidden="true">({remaining} dtk)</span>
                <span className="sr-only">dalam {remaining} detik</span>
              </>
            ) : (
              "Kirim ulang kode"
            )}
          </Button>
          <span className="sr-only" role="status">
            {remaining === 0 ? "Kamu bisa meminta kode baru." : ""}
          </span>
          <Link
            href="/register"
            onClick={clearVerifyEmail}
            className="inline-flex min-h-11 items-center text-label font-medium text-accent"
          >
            Salah email? Ubah
          </Link>
        </div>
      </AuthCard>
    </GuestOnly>
  );
}
