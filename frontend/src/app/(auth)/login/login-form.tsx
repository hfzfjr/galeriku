"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { loginRequestSchema } from "@galeriku/contracts";
import { useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError, FormInfo } from "@/components/auth/form-message";
import { GuestOnly } from "@/components/auth/guest-only";
import { PasswordInput } from "@/components/auth/password-input";
import {
  TurnstileField,
  type TurnstileHandle,
  type TurnstileStatus,
} from "@/components/auth/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAccount } from "@/lib/api";
import {
  isApiRequestError,
  toFieldErrorMap,
  toIndonesianMessage,
} from "@/lib/auth-errors";
import {
  TURNSTILE_REQUIRED_MESSAGE,
  zodToFieldErrors,
} from "@/lib/form-validation";
import { saveVerifyEmail } from "@/lib/pending-email";
import { ME_QUERY_KEY } from "@/lib/session";

const RESET_INFO_MESSAGE =
  "Password sudah diganti. Masuk dengan password barumu. Semua perangkat lain sudah keluar otomatis.";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaStatus, setCaptchaStatus] =
    useState<TurnstileStatus>("memuat");
  const captchaRef = useRef<TurnstileHandle>(null);
  const [pending, setPending] = useState(false);

  const showResetInfo = searchParams.get("info") === "reset";
  const captchaBroken = captchaStatus === "gagal";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setFormError(null);
    setFieldErrors({});

    const parsed = loginRequestSchema.safeParse({
      email,
      password,
      turnstileToken: captchaToken ?? "",
    });
    if (!parsed.success) {
      const mapped = zodToFieldErrors(parsed.error.issues);
      setFieldErrors({
        email: mapped.fields.email,
        password: mapped.fields.password,
      });
      if (mapped.turnstileMissing) {
        setFormError(TURNSTILE_REQUIRED_MESSAGE);
      }
      return;
    }

    setPending(true);
    try {
      const me = await loginAccount(parsed.data);
      queryClient.setQueryData(ME_QUERY_KEY, me);
      router.replace("/app");
    } catch (error) {
      // Token Turnstile sekali pakai: reset setelah submit yang gagal.
      captchaRef.current?.reset();
      setCaptchaToken(null);
      if (isApiRequestError(error) && error.code === "EMAIL_NOT_VERIFIED") {
        // Backend TIDAK mengirim OTP baru saat login ditolak; kode
        // diminta sekali saat tiba di /verify-email.
        saveVerifyEmail({
          email: parsed.data.email,
          sentAt: Date.now(),
          fromLogin: true,
        });
        router.replace("/verify-email");
        return;
      }
      const mapped = toFieldErrorMap(error);
      if (mapped.email !== undefined || mapped.password !== undefined) {
        setFieldErrors({ email: mapped.email, password: mapped.password });
      } else {
        setFormError(toIndonesianMessage(error));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <GuestOnly>
      <AuthCard title="Masuk">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {showResetInfo ? <FormInfo message={RESET_INFO_MESSAGE} /> : null}
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="nama@contoh.id"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
            disabled={pending}
            required
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            placeholder="Password kamu"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            disabled={pending}
            required
          />
          <TurnstileField
            ref={captchaRef}
            onToken={setCaptchaToken}
            onStatusChange={setCaptchaStatus}
          />
          {formError ? <FormError message={formError} /> : null}
          <Button
            type="submit"
            variant="primary"
            loading={pending}
            disabled={captchaBroken}
            className="w-full"
          >
            Masuk
          </Button>
          <div className="flex flex-col gap-1">
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 items-center text-label font-medium text-accent"
            >
              Lupa password?
            </Link>
            <p className="text-body text-ink-muted">
              Belum punya akun?{" "}
              <Link
                href="/register"
                className="inline-flex min-h-11 items-center text-label font-medium text-accent"
              >
                Daftar
              </Link>
            </p>
          </div>
        </form>
      </AuthCard>
    </GuestOnly>
  );
}
