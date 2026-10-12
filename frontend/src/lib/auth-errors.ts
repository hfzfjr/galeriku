import {
  ApiRequestError,
  NETWORK_ERROR_CODE,
  UNKNOWN_ERROR_CODE,
} from "./api";
import { GOOGLE_ERROR_CODES } from "@galeriku/contracts";

/**
 * Pemetaan kode galat API ke pesan Bahasa Indonesia (DESIGN.md §8).
 * Kalimat pendek, sapaan "kamu". Login tidak membedakan email tak
 * terdaftar vs password salah (satu pesan INVALID_CREDENTIALS).
 */

export const GENERIC_ERROR_MESSAGE =
  "Terjadi kesalahan. Muat ulang halaman lalu coba lagi.";

export const NETWORK_ERROR_MESSAGE = "Tidak bisa terhubung ke Galeriku. Coba lagi.";

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

/** True bila layar "Galeriku lagi istirahat" yang berlaku (jaringan/5xx). */
export function isServiceDown(error: unknown): boolean {
  if (!isApiRequestError(error)) {
    return false;
  }
  return error.code === NETWORK_ERROR_CODE || error.statusCode >= 500;
}

export function toIndonesianMessage(error: unknown): string {
  if (!isApiRequestError(error)) {
    return GENERIC_ERROR_MESSAGE;
  }
  switch (error.code) {
    case NETWORK_ERROR_CODE:
      return NETWORK_ERROR_MESSAGE;
    case "INVALID_CREDENTIALS":
      return "Email atau password tidak cocok.";
    case "EMAIL_NOT_VERIFIED":
      return "Email kamu belum diverifikasi. Masukkan kode yang kami kirim.";
    case "ACCOUNT_SUSPENDED":
      // Pesan server sudah memuat email kontak bila CONTACT_EMAIL
      // dikonfigurasi di backend; frontend tidak membuat env baru.
      return typeof error.message === "string" && error.message.length > 0
        ? error.message
        : "Akunmu sedang ditangguhkan. Hubungi admin.";
    case "INVALID_CODE":
      return "Kode salah atau sudah tidak berlaku. Minta kode baru jika perlu.";
    case "EMAIL_TAKEN":
      return "Email ini sudah terdaftar. Masuk atau atur ulang password.";
    case "TURNSTILE_FAILED":
      return "Pemeriksaan keamanan gagal. Coba lagi.";
    case "TURNSTILE_UNAVAILABLE":
      return "Pemeriksaan keamanan sedang bermasalah. Coba lagi sebentar lagi.";
    case "RATE_LIMITED":
      if (error.retryAfterSec !== undefined && error.retryAfterSec > 0) {
        return `Terlalu banyak percobaan. Coba lagi dalam ${error.retryAfterSec} detik.`;
      }
      return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
    case "VALIDATION_ERROR": {
      const fields = extractFieldErrors(error.details);
      if (fields.length > 0) {
        return fields[0].message;
      }
      return "Data yang dikirim tidak valid.";
    }
    case UNKNOWN_ERROR_CODE:
    case "FORBIDDEN_ORIGIN":
    default:
      return GENERIC_ERROR_MESSAGE;
  }
}

export type FieldError = { field: string; message: string };

/**
 * Pesan untuk ?error= redirect Google OAuth (US-11, DESIGN.md §8).
 * Kode tak dikenal -> pesan umum. Daftar kode dari packages/contracts.
 */
export function googleErrorMessage(code: string | null): string {
  switch (code) {
    case GOOGLE_ERROR_CODES.google_cancelled:
      return "Login dengan Google dibatalkan.";
    case GOOGLE_ERROR_CODES.google_failed:
      return "Login dengan Google gagal. Coba lagi.";
    case GOOGLE_ERROR_CODES.google_unverified:
      return "Email Google kamu belum terverifikasi, jadi belum bisa dipakai masuk.";
    case GOOGLE_ERROR_CODES.google_unavailable:
      return "Google sedang tidak bisa dihubungi. Coba lagi sebentar lagi.";
    case GOOGLE_ERROR_CODES.suspended:
      return "Akunmu sedang ditangguhkan. Hubungi admin.";
    case GOOGLE_ERROR_CODES.rate_limited:
      return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
    default:
      return GENERIC_ERROR_MESSAGE;
  }
}

/**
 * details VALIDATION_ERROR backend: { fields: [{ field, message }] }.
 * Kembalikan daftar kosong bila bentuknya tak dikenal.
 */
export function extractFieldErrors(details: unknown): FieldError[] {
  if (typeof details !== "object" || details === null) {
    return [];
  }
  const fields = (details as Record<string, unknown>).fields;
  if (!Array.isArray(fields)) {
    return [];
  }
  const result: FieldError[] = [];
  for (const entry of fields) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.field === "string" && typeof record.message === "string") {
      result.push({ field: record.field, message: record.message });
    }
  }
  return result;
}

/**
 * Petakan details VALIDATION_ERROR ke error per-field form
 * (email, password, name, code, newPassword). Kunci tak dikenal diabaikan.
 */
export function toFieldErrorMap(
  error: unknown,
): Partial<Record<"email" | "password" | "name" | "code" | "newPassword", string>> {
  if (!isApiRequestError(error) || error.code !== "VALIDATION_ERROR") {
    return {};
  }
  const map: Partial<Record<string, string>> = {};
  for (const { field, message } of extractFieldErrors(error.details)) {
    const key = field === "newPassword" ? "newPassword" : field;
    if (
      (key === "email" ||
        key === "password" ||
        key === "name" ||
        key === "code" ||
        key === "newPassword") &&
      map[key] === undefined
    ) {
      map[key] = message;
    }
  }
  return map;
}
