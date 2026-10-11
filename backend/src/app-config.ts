import { z } from 'zod';

// Konfigurasi backend dari environment, divalidasi saat start (gagal cepat).
// Aturan per US-09: FRONTEND_ORIGIN wajib di produksi; ADMIN_EMAIL wajib
// di produksi (hanya dibaca ke konfigurasi di US-09, penetapan peran di
// US-09b); DEFAULT_QUOTA_BYTES angka valid (default 5 GB bila tak diset);
// IP_HASH_SECRET minimal 32 karakter dan wajib di produksi;
// TURNSTILE_SECRET_KEY selalu wajib; CONTACT_EMAIL opsional.

export type AppConfig = {
  isProduction: boolean;
  frontendOrigin: string;
  adminEmail: string | undefined;
  defaultQuotaBytes: bigint;
  ipHashSecret: string;
  turnstileSecretKey: string;
  contactEmail: string | undefined;
};

export const APP_CONFIG = 'APP_CONFIG';

const DEFAULT_QUOTA_BYTES = 5368709120n;
// Secret khusus dev lokal (http). Tidak pernah dipakai di produksi:
// di produksi IP_HASH_SECRET wajib diisi (validasi di bawah).
const DEV_IP_HASH_SECRET = 'dev-only-ip-hash-secret-minimal-32-kar';

function optional(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const raw = env[key]?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const isProduction = env.NODE_ENV === 'production';

  const originRaw = optional(env, 'FRONTEND_ORIGIN');
  if (!originRaw && isProduction) {
    throw new Error('FRONTEND_ORIGIN wajib diisi di production.');
  }
  const frontendOrigin = (originRaw ?? 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );

  const adminRaw = optional(env, 'ADMIN_EMAIL');
  if (!adminRaw && isProduction) {
    throw new Error('ADMIN_EMAIL wajib diisi di production.');
  }
  const adminEmail = adminRaw?.toLowerCase();

  const quotaRaw = optional(env, 'DEFAULT_QUOTA_BYTES');
  let defaultQuotaBytes = DEFAULT_QUOTA_BYTES;
  if (quotaRaw !== undefined) {
    if (!/^\d+$/.test(quotaRaw)) {
      throw new Error('DEFAULT_QUOTA_BYTES harus angka bulat positif.');
    }
    defaultQuotaBytes = BigInt(quotaRaw);
    if (defaultQuotaBytes <= 0n) {
      throw new Error('DEFAULT_QUOTA_BYTES harus angka bulat positif.');
    }
  }

  const secretRaw = optional(env, 'IP_HASH_SECRET');
  if (!secretRaw && isProduction) {
    throw new Error('IP_HASH_SECRET wajib diisi di production.');
  }
  const ipHashSecret = secretRaw ?? DEV_IP_HASH_SECRET;
  if (ipHashSecret.length < 32) {
    throw new Error('IP_HASH_SECRET minimal 32 karakter.');
  }

  const turnstileSecretKey = optional(env, 'TURNSTILE_SECRET_KEY');
  if (!turnstileSecretKey) {
    throw new Error('TURNSTILE_SECRET_KEY wajib diisi.');
  }

  const contactRaw = optional(env, 'CONTACT_EMAIL');
  if (contactRaw !== undefined && !/.+@.+/.test(contactRaw)) {
    throw new Error('CONTACT_EMAIL tidak valid.');
  }

  return {
    isProduction,
    frontendOrigin,
    adminEmail,
    defaultQuotaBytes,
    ipHashSecret,
    turnstileSecretKey,
    contactEmail: contactRaw,
  };
}

// Skema validasi untuk uji (unit): memastikan env contoh tetap valid.
export const appConfigSchema = z.object({
  frontendOrigin: z.string().min(1),
  defaultQuotaBytes: z.bigint().positive(),
  ipHashSecret: z.string().min(32),
  turnstileSecretKey: z.string().min(1),
});
