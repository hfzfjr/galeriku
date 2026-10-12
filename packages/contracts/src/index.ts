import { z } from 'zod';

// Kode error auth yang disepakati (US-09). Bentuk respons:
// { statusCode, code, message, details? }.
export const AUTH_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  TURNSTILE_FAILED: 'TURNSTILE_FAILED',
  TURNSTILE_UNAVAILABLE: 'TURNSTILE_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN_ORIGIN: 'FORBIDDEN_ORIGIN',
  INVALID_CODE: 'INVALID_CODE',
  GOOGLE_UNCONFIGURED: 'GOOGLE_UNCONFIGURED',
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export type ApiErrorBody = {
  statusCode: number;
  code: AuthErrorCode;
  message: string;
  details?: unknown;
};

// Kode error alur Google OAuth untuk parameter ?error= pada redirect ke
// /login (US-11). Daftar bersama agar backend dan frontend memakai
// kode yang sama. Bukan bagian ApiErrorBody (redirect, bukan JSON).
export const GOOGLE_ERROR_CODES = {
  google_cancelled: 'google_cancelled',
  google_failed: 'google_failed',
  google_unverified: 'google_unverified',
  google_unavailable: 'google_unavailable',
  suspended: 'suspended',
  rate_limited: 'rate_limited',
} as const;

export type GoogleErrorCode =
  (typeof GOOGLE_ERROR_CODES)[keyof typeof GOOGLE_ERROR_CODES];

// Normalisasi email dipakai di batas API dan di rate limit login
// (kunci per email) agar konsisten: trim + lowercase.
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const normalizedEmail = z
  .string()
  .transform((value) => normalizeEmail(value))
  .pipe(z.string().max(254).email());

const trimmedName = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(60));

export const registerRequestSchema = z.object({
  name: trimmedName,
  email: normalizedEmail,
  // 8-128 karakter, tanpa aturan komposisi; spasi tidak dipangkas.
  password: z.string().min(8).max(128),
  turnstileToken: z.string().min(1),
});

export type RegisterRequest = z.output<typeof registerRequestSchema>;

export const registerResponseSchema = z.object({
  email: z.string().email(),
  needsVerification: z.literal(true),
});

export type RegisterResponse = z.output<typeof registerResponseSchema>;

export const loginRequestSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(8).max(128),
  turnstileToken: z.string().min(1),
});

export type LoginRequest = z.output<typeof loginRequestSchema>;

// Kode OTP: tepat 6 digit angka.
const otpCode = z.string().regex(/^\d{6}$/);

export const verifyEmailRequestSchema = z.object({
  email: normalizedEmail,
  code: otpCode,
});

export type VerifyEmailRequest = z.output<typeof verifyEmailRequestSchema>;

export const resendCodeRequestSchema = z.object({
  email: normalizedEmail,
});

export type ResendCodeRequest = z.output<typeof resendCodeRequestSchema>;

export const acceptedResponseSchema = z.object({
  accepted: z.literal(true),
});

export type AcceptedResponse = z.output<typeof acceptedResponseSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: normalizedEmail,
  turnstileToken: z.string().min(1),
});

export type ForgotPasswordRequest = z.output<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  email: normalizedEmail,
  code: otpCode,
  newPassword: z.string().min(8).max(128),
});
export type ResetPasswordRequest = z.output<typeof resetPasswordRequestSchema>;

// quotaBytes selalu string di JSON (BigInt tidak boleh mentah).
export const meResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.string(),
  status: z.string(),
  quotaBytes: z.string(),
  emailVerifiedAt: z.string().nullable(),
});

export type MeResponse = z.output<typeof meResponseSchema>;
