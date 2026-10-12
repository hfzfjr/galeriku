"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerRequestSchema } from "@galeriku/contracts";
import { useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError } from "@/components/auth/form-message";
import { GuestOnly } from "@/components/auth/guest-only";
import { PasswordInput } from "@/components/auth/password-input";
import {
  TurnstileField,
  type TurnstileHandle,
  type TurnstileStatus,
} from "@/components/auth/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerAccount } from "@/lib/api";
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

// Aturan password diambil dari contracts: 8–128 karakter, tanpa komposisi.
const PASSWORD_HINT = "Minimal 8 karakter.";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
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
    setEmailTaken(false);
    setFieldErrors({});

    const parsed = registerRequestSchema.safeParse({
      name,
      email,
      password,
      turnstileToken: captchaToken ?? "",
    });
    if (!parsed.success) {
      const mapped = zodToFieldErrors(parsed.error.issues);
      setFieldErrors({
        name: mapped.fields.name,
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
      const result = await registerAccount(parsed.data);
      saveVerifyEmail({ email: result.email, sentAt: Date.now() });
      router.replace("/verify-email");
    } catch (error) {
      // Token Turnstile sekali pakai: reset setelah submit yang gagal.
      captchaRef.current?.reset();
      setCaptchaToken(null);
      if (isApiRequestError(error) && error.code === "EMAIL_TAKEN") {
        setEmailTaken(true);
        setFormError(toIndonesianMessage(error));
        return;
      }
      const mapped = toFieldErrorMap(error);
      if (
        mapped.name !== undefined ||
        mapped.email !== undefined ||
        mapped.password !== undefined
      ) {
        setFieldErrors({
          name: mapped.name,
          email: mapped.email,
          password: mapped.password,
        });
      } else {
        setFormError(toIndonesianMessage(error));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <GuestOnly>
      <AuthCard title="Buat akun">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Input
            label="Nama"
            type="text"
            autoComplete="name"
            placeholder="Namamu"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fieldErrors.name}
            disabled={pending}
            required
          />
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
            autoComplete="new-password"
            placeholder="Buat password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            hint={PASSWORD_HINT}
            disabled={pending}
            required
          />
          <TurnstileField
            ref={captchaRef}
            onToken={setCaptchaToken}
            onStatusChange={setCaptchaStatus}
          />
          {formError ? <FormError message={formError} /> : null}
          {emailTaken ? (
            <div className="flex flex-col gap-1">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center text-label font-medium text-accent"
              >
                Masuk
              </Link>
              <Link
                href="/forgot-password"
                className="inline-flex min-h-11 items-center text-label font-medium text-accent"
              >
                Atur ulang password
              </Link>
            </div>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            loading={pending}
            disabled={captchaBroken}
            className="w-full"
          >
            Daftar
          </Button>
          <p className="text-body text-ink-muted">
            Sudah punya akun?{" "}
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
