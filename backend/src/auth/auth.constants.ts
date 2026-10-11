// Konstanta auth US-09 (satu tempat).

// Nama cookie sesi. Host-only: tanpa atribut Domain.
export const SESSION_COOKIE = 'galeriku_session';

// Sesi 30 hari, tetap (tidak diperpanjang saat dipakai).
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

// Batas rate limit (limiter memori sendiri untuk per IP dan per email).
export const REGISTER_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
export const LOGIN_IP_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };
export const LOGIN_EMAIL_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
export const VERIFY_IP_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };
export const VERIFY_EMAIL_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };
export const RESEND_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
export const RESEND_EMAIL_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };
export const FORGOT_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
export const FORGOT_EMAIL_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };
export const RESET_IP_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };
export const RESET_EMAIL_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

// Jeda kirim ulang kode OTP (diterapkan di sisi server).
export const RESEND_WINDOW_MS = 60 * 1000;
