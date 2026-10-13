"use client";

import { useRouter } from "next/navigation";
import { resetPasswordRequestSchema } from "@galeriku/contracts";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormInfo } from "@/components/auth/form-message";
import { AuthLoadingSkeleton, GuestOnly } from "@/components/auth/guest-only";
import { OtpInput, OtpLabel } from "@/components/auth/otp-input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/lib/api";
import { toFieldErrorMap, toIndonesianMessage } from "@/lib/auth-errors";
import { zodToFieldErrors } from "@/lib/form-validation";
import {
  clearResetEmail,
  getResetEmail,
  type PendingEmail,
} from "@/lib/pending-email";

// Aturan password baru sama dengan pendaftaran (dari contracts).
const PASSWORD_HINT = "Minimal 8 karakter.";

export function ResetPasswordForm() {
  const router = useRouter();
  const [account, setAccount] = useState<PendingEmail | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(
    undefined,
  );
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Ditunda ke callback agar lolos aturan set-state-in-effect dan
    // render pertama sama dengan SSR (pola yang sama dengan ThemeProvider).
    const timeout = window.setTimeout(() => {
      const stored = getResetEmail();
      if (!stored) {
        router.replace("/login");
        return;
      }
      setAccount(stored);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !account) {
      return;
    }
    setCodeError(undefined);
    setPasswordError(undefined);

    const parsed = resetPasswordRequestSchema.safeParse({
      email: account.email,
      code,
      newPassword,
    });
    if (!parsed.success) {
      const mapped = zodToFieldErrors(parsed.error.issues);
      setCodeError(mapped.code);
      setPasswordError(mapped.newPassword);
      if (mapped.code) {
        inputRef.current?.focus();
      }
      return;
    }

    setPending(true);
    try {
      await resetPassword(parsed.data);
      clearResetEmail();
      // Bendera info sederhana lewat query (bukan token/rahasia).
      router.replace("/login?info=reset");
    } catch (error) {
      const mapped = toFieldErrorMap(error);
      if (mapped.code !== undefined || mapped.newPassword !== undefined) {
        setCodeError(mapped.code);
        setPasswordError(mapped.newPassword);
      } else {
        // INVALID_CODE: pesan tunggal tanpa sisa percobaan; kosongkan
        // input dan fokus kembali.
        setCode("");
        setCodeError(toIndonesianMessage(error));
        inputRef.current?.focus();
      }
    } finally {
      setPending(false);
    }
  }

  if (!ready || !account) {
    return <AuthLoadingSkeleton />;
  }

  return (
    <GuestOnly>
      <AuthCard title="Atur password baru">
        <div className="flex flex-col gap-4">
          <FormInfo message="Kalau email itu terdaftar, kode sudah kami kirim." />
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <OtpLabel htmlFor="kode-reset">Kode dari email</OtpLabel>
              <OtpInput
                ref={inputRef}
                id="kode-reset"
                label="Kode dari email"
                value={code}
                onChange={(next) => {
                  setCode(next);
                  if (codeError) {
                    setCodeError(undefined);
                  }
                }}
                error={codeError}
                disabled={pending}
              />
            </div>
            <PasswordInput
              label="Password baru"
              autoComplete="new-password"
              placeholder="Buat password baru"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              error={passwordError}
              hint={PASSWORD_HINT}
              disabled={pending}
              required
            />
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              className="w-full"
            >
              Simpan password
            </Button>
          </form>
        </div>
      </AuthCard>
    </GuestOnly>
  );
}
