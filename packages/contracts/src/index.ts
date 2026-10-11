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
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export type ApiErrorBody = {
  statusCode: number;
  code: AuthErrorCode;
  message: string;
  details?: unknown;
};

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
