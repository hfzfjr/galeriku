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
  NOT_FOUND: 'NOT_FOUND',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  LOCKED: 'LOCKED',
  DOWNLOAD_FORBIDDEN: 'DOWNLOAD_FORBIDDEN',
  BAD_REQUEST: 'BAD_REQUEST',
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
  usedBytes: z.string().optional(),
  hasPassword: z.boolean().optional(),
  emailVerifiedAt: z.string().nullable(),
});

export type MeResponse = z.output<typeof meResponseSchema>;

// Set password akun Google (US-15)
export const setPasswordRequestSchema = z.object({
  password: z.string().min(8, 'Password minimal 8 karakter.').max(128),
});

export type SetPasswordRequest = z.output<typeof setPasswordRequestSchema>;

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

// Files (US-20: Grid Galeri)
export const fileItemSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.string().regex(/^\d+$/),
  kind: z.enum(['image', 'video']),
  width: z.number().nullable(),
  height: z.number().nullable(),
  durationS: z.number().nullable(),
  thumbKey: z.string().nullable(),
  status: z.string(),
  isFavorite: z.boolean().default(false),
  takenAt: z.string().nullable(),
  createdAt: z.string(),
  deletedAt: z.string().nullable().optional(),
});

export type FileItem = z.output<typeof fileItemSchema>;

export const filesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  cursor: z.string().min(1).max(200).optional(),
  kind: z.enum(['image', 'video']).optional(),
  favorite: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .optional(),
});

export type FilesQuery = z.output<typeof filesQuerySchema>;

export const filesResponseSchema = z.object({
  items: z.array(fileItemSchema),
  nextCursor: z.string().nullable(),
});

export type FilesResponse = z.output<typeof filesResponseSchema>;

export const setFileFavoriteSchema = z.object({
  isFavorite: z.boolean(),
});

export type SetFileFavoriteRequest = z.output<typeof setFileFavoriteSchema>;

export const trashFilesResponseSchema = z.object({
  items: z.array(fileItemSchema),
});

export type TrashFilesResponse = z.output<typeof trashFilesResponseSchema>;

export const batchDeleteFilesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export type BatchDeleteFilesRequest = z.output<typeof batchDeleteFilesSchema>;

// Albums (US-23: Album)
export const createAlbumSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Judul album tidak boleh kosong.')
    .max(100, 'Judul album maksimal 100 karakter.'),
});

export type CreateAlbumRequest = z.output<typeof createAlbumSchema>;

export const updateAlbumSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Judul album tidak boleh kosong.')
    .max(100, 'Judul album maksimal 100 karakter.'),
});

export type UpdateAlbumRequest = z.output<typeof updateAlbumSchema>;

export const addAlbumFilesSchema = z.object({
  fileIds: z.array(z.string().min(1)).min(1, 'Pilih minimal satu file.').max(100),
});

export type AddAlbumFilesRequest = z.output<typeof addAlbumFilesSchema>;

export const albumItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  coverFileId: z.string().nullable(),
  coverThumbKey: z.string().nullable().optional(),
  fileCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export type AlbumItem = z.output<typeof albumItemSchema>;

export const albumsResponseSchema = z.object({
  items: z.array(albumItemSchema),
});

export type AlbumsResponse = z.output<typeof albumsResponseSchema>;

export const albumDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  coverFileId: z.string().nullable(),
  fileCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  files: z.array(fileItemSchema),
});

export type AlbumDetail = z.output<typeof albumDetailSchema>;

// Shares & Public Link (US-24, US-25, US-26, US-27)
export const shareTargetSchema = z.enum(['FILE', 'ALBUM']);
export type ShareTarget = z.output<typeof shareTargetSchema>;

export const shareExpiryOptionSchema = z.enum([
  '1_DAY',
  '7_DAYS',
  '30_DAYS',
  'NEVER',
]);
export type ShareExpiryOption = z.output<typeof shareExpiryOptionSchema>;

export const createShareLinkSchema = z.object({
  targetType: shareTargetSchema,
  targetId: z.string().min(1, 'Target ID tidak boleh kosong.'),
  allowDownload: z.boolean().default(true),
  expiry: shareExpiryOptionSchema.default('30_DAYS'),
  password: z.string().max(100).optional(),
});

export type CreateShareLinkRequest = z.output<typeof createShareLinkSchema>;

export const updateShareLinkSchema = z.object({
  allowDownload: z.boolean().optional(),
  expiry: shareExpiryOptionSchema.optional(),
  password: z.string().max(100).optional().nullable(),
});

export type UpdateShareLinkRequest = z.output<typeof updateShareLinkSchema>;

export const unlockShareSchema = z.object({
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
});

export type UnlockShareRequest = z.output<typeof unlockShareSchema>;

export const shareLinkItemSchema = z.object({
  id: z.string(),
  token: z.string(),
  targetType: shareTargetSchema,
  targetId: z.string(),
  targetTitle: z.string(),
  allowDownload: z.boolean(),
  viewCount: z.number().int().nonnegative(),
  expiresAt: z.string().nullable(),
  hasPassword: z.boolean(),
  isRevoked: z.boolean(),
  createdAt: z.string(),
});

export type ShareLinkItem = z.output<typeof shareLinkItemSchema>;

export const shareLinksResponseSchema = z.object({
  items: z.array(shareLinkItemSchema),
});

export type ShareLinksResponse = z.output<typeof shareLinksResponseSchema>;

// Public Share View (US-25, US-26)
export const publicShareResponseSchema = z.object({
  token: z.string(),
  targetType: shareTargetSchema,
  title: z.string(),
  allowDownload: z.boolean(),
  createdAt: z.string(),
  hasPassword: z.boolean(),
  isUnlocked: z.boolean(),
  files: z.array(fileItemSchema),
});

export type PublicShareResponse = z.output<typeof publicShareResponseSchema>;





