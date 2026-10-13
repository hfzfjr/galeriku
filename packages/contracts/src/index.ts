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
  FORBIDDEN: 'FORBIDDEN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CANNOT_MODIFY_SELF: 'CANNOT_MODIFY_SELF',
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

// Batas kuota maksimum per pengguna (US-12): 1000 GB dalam byte.
export const ADMIN_MAX_QUOTA_BYTES = 1000n * 1024n * 1024n * 1024n;

// Daftar pengguna (US-12): pencarian server, 20 per halaman (maks 50),
// urut created_at DESC lalu id, cursor buram berisi id terakhir.
export const adminUsersQuerySchema = z.object({
  q: z.string().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(200).optional(),
});

export type AdminUsersQuery = z.output<typeof adminUsersQuerySchema>;

// Satu baris daftar: tanpa password_hash, google_sub, atau data sesi.
// BigInt selalu string.
export const adminUserItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  role: z.string(),
  status: z.string(),
  emailVerified: z.boolean(),
  quotaBytes: z.string().regex(/^\d+$/),
  usedBytes: z.string().regex(/^\d+$/),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
});

export type AdminUserItem = z.output<typeof adminUserItemSchema>;

export const adminUsersResponseSchema = z.object({
  items: z.array(adminUserItemSchema),
  nextCursor: z.string().nullable(),
});

export type AdminUsersResponse = z.output<typeof adminUsersResponseSchema>;

// Ubah kuota (US-12): string angka byte tak negatif, maks 1000 GB.
// String agar BigInt aman di JSON.
const quotaBytesString = z
  .string()
  .regex(/^\d+$/, 'Kuota harus bilangan bulat tak negatif dalam byte.')
  .refine(
    (value) => {
      try {
        return BigInt(value) <= ADMIN_MAX_QUOTA_BYTES;
      } catch {
        return false;
      }
    },
    { message: 'Kuota maksimal 1000 GB.' },
  );

export const updateQuotaRequestSchema = z.object({
  quotaBytes: quotaBytesString,
});

export type UpdateQuotaRequest = z.output<typeof updateQuotaRequestSchema>;
