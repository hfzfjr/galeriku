import { toStandardErrorBody } from './fastify-error-handler';

describe('toStandardErrorBody', () => {
  it('400/401/403/404/413/415/429 dipetakan ke kode standar', () => {
    expect(toStandardErrorBody({ statusCode: 400 })).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Data yang dikirim tidak valid.',
    });
    expect(toStandardErrorBody({ statusCode: 401 }).code).toBe(
      'UNAUTHENTICATED',
    );
    expect(toStandardErrorBody({ statusCode: 403 }).code).toBe('FORBIDDEN');
    expect(toStandardErrorBody({ statusCode: 404 })).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Tidak ditemukan.',
    });
    expect(toStandardErrorBody({ statusCode: 413 }).code).toBe(
      'PAYLOAD_TOO_LARGE',
    );
    expect(toStandardErrorBody({ statusCode: 415 }).code).toBe(
      'UNSUPPORTED_MEDIA_TYPE',
    );
    expect(toStandardErrorBody({ statusCode: 429 }).code).toBe('RATE_LIMITED');
  });

  it('5xx dan tanpa status jadi INTERNAL_ERROR generik', () => {
    expect(toStandardErrorBody({ statusCode: 500 })).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan. Muat ulang halaman lalu coba lagi.',
    });
    expect(toStandardErrorBody({})).toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });

  it('4xx lain yang tak dikenal jadi VALIDATION_ERROR', () => {
    expect(toStandardErrorBody({ statusCode: 422 }).code).toBe(
      'VALIDATION_ERROR',
    );
  });
});
