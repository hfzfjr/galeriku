// Normalisasi galat 404 tus ke bentuk API standar. @tus/server menulis
// galat sebagai teks polos ("The file for this url was not found\n");
// onResponseError hanya boleh mengembalikan {status_code, body} (tanpa
// header), sehingga hasil normalisasi adalah string JSON dengan
// Content-Type teks. Yang penting: id milik orang lain dan id tak ada
// menghasilkan body PERSIS sama (aturan ownership AGENTS.md).
export type TusErrorLike = {
  status_code?: unknown;
  body?: unknown;
};

export type TusErrorMapping = {
  status_code: number;
  body: string;
};

const NOT_FOUND_BODY = 'The file for this url was not found\n';

export const STANDARD_NOT_FOUND_BODY = JSON.stringify({
  statusCode: 404,
  code: 'NOT_FOUND',
  message: 'Tidak ditemukan.',
});

export function mapTus404ToStandard(
  error: TusErrorLike,
): TusErrorMapping | undefined {
  if (error?.status_code === 404 && error?.body === NOT_FOUND_BODY) {
    return { status_code: 404, body: STANDARD_NOT_FOUND_BODY };
  }
  return undefined;
}
