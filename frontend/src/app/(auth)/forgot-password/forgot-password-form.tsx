"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { forgotPasswordRequestSchema } from "@galeriku/contracts";
import { useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError } from "@/components/auth/form-message";
import { GuestOnly } from "@/components/auth/guest-only";
import {
  TurnstileField,
  type TurnstileHandle,
  type TurnstileStatus,
} from "@/components/auth/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/lib/api";
import { toFieldErrorMap, toIndonesianMessage } from "@/lib/auth-errors";
import {
  TURNSTILE_REQUIRED_MESSAGE,
  zodToFieldErrors,
} from "@/lib/form-validation";
import { saveResetEmail } from "@/lib/pending-email";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaStatus, setCaptchaStatus] =
    useState<TurnstileStatus>("memuat");
  const captchaRef = useRef<TurnstileHandle>(null);
  const [pending, setPending] = useState(false);

  const captchaBroken = captchaStatus === "gagal";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setFormError(null);
    setFieldError(undefined);

    const parsed = forgotPasswordRequestSchema.safeParse({
      email,
      turnstileToken: captchaToken ?? "",
    });
    if (!parsed.success) {
      const mapped = zodToFieldErrors(parsed.error.issues);
      setFieldError(mapped.fields.email);
      if (mapped.turnstileMissing && !mapped.fields.email) {
        setFormError(TURNSTILE_REQUIRED_MESSAGE);
      }
      return;
    }

    setPending(true);
    try {
      await forgotPassword(parsed.data);
      // Respons selalu sama apa pun hasilnya (tidak membocorkan email).
      saveResetEmail({ email: parsed.data.email, sentAt: Date.now() });
      router.replace("/reset-password");
    } catch (error) {
      // Token Turnstile sekali pakai: reset setelah submit yang gagal.
      captchaRef.current?.reset();
      setCaptchaToken(null);
      const mapped = toFieldErrorMap(error);
      if (mapped.email !== undefined) {
        setFieldError(mapped.email);
      } else {
        setFormError(toIndonesianMessage(error));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <GuestOnly>
      <AuthCard
        title="Lupa password"
        description="Masukkan email yang kamu pakai daftar. Kami kirim kode 6 digit untuk membuat password baru."
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="nama@contoh.id"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldError}
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
            Kirim kode
          </Button>
          <p className="text-body text-ink-muted">
            Ingat passwordnya?{" "}
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-label font-medium text-accent"
            >
              Masuk
            </Link>
          </p>
        </form>
      </AuthCard>
    </GuestOnly>
  );
}
