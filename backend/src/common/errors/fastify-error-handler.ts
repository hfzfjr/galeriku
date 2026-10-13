import type { FastifyError, FastifyReply } from 'fastify';
import type { AuthErrorCode } from '@galeriku/contracts';

export type StandardErrorBody = {
  statusCode: number;
  code: AuthErrorCode | 'INTERNAL_ERROR';
  message: string;
};

// Galat yang dihasilkan Fastify SEBELUM masuk pipeline Nest (body kosong
// atau JSON rusak dengan Content-Type JSON, Content-Type tak didukung,
// payload melebihi bodyLimit, route tak dikenal) dibungkus ke bentuk
// standar {statusCode, code, message} agar sama dengan galat Nest.
// Bahasa Indonesia, pendek, tanpa detail internal/stack/nama kelas/path.
export function toStandardErrorBody(error: {
  statusCode?: unknown;
}): StandardErrorBody {
  const status =
    typeof error.statusCode === 'number' ? error.statusCode : 500;
  switch (status) {
    case 400:
      return {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Data yang dikirim tidak valid.',
      };
    case 401:
      return {
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Masuk dulu untuk melanjutkan.',
      };
    case 403:
      return {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Kamu tidak punya akses ke halaman ini.',
      };
    case 404:
      return {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Tidak ditemukan.',
      };
    case 413:
      return {
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Data yang dikirim terlalu besar.',
      };
    case 415:
      return {
        statusCode: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Tipe konten permintaan tidak didukung.',
      };
    case 429:
      return {
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
      };
    default:
      if (status >= 500) {
        return {
          statusCode: status,
          code: 'INTERNAL_ERROR',
          message: 'Terjadi kesalahan. Muat ulang halaman lalu coba lagi.',
        };
      }
      return {
        statusCode: status,
        code: 'VALIDATION_ERROR',
        message: 'Data yang dikirim tidak valid.',
      };
  }
}

// Hanya untuk galat level adapter Fastify. Galat dari controller/guard/
// pipe Nest tetap lewat ApiExceptionFilter (tidak berubah).
export function sendStandardError(
  reply: FastifyReply,
  error: FastifyError,
): void {
  const body = toStandardErrorBody(error);
  reply
    .status(body.statusCode)
    .send({ statusCode: body.statusCode, code: body.code, message: body.message });
}
