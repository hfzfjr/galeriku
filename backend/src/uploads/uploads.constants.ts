// Konstanta upload tus & validasi US-18.
export const TUS_ROUTE_PATH = '/uploads';

// Batas global tus server: 2 GB (2147483648). Sesuai batas video v1.0.
export const TUS_SERVER_MAX_SIZE_BYTES = 2147483648;
export const TUS_SPIKE_MAX_SIZE_BYTES = TUS_SERVER_MAX_SIZE_BYTES;

// Kunci metadata tus untuk pemilik upload. Ditulis sisi server di
// onUploadCreate (menimpa bila klien mengirim kunci yang sama).
export const TUS_OWNER_METADATA_KEY = 'ownerId';

// Kunci titipan SessionUser di objek request mentah Node (IncomingMessage)
// agar hook @tus/server (yang hanya menerima web Request) bisa membaca
// hasil guard Nest. Diisi controller SETELAH guard lolos.
export const TUS_AUTH_USER_KEY = '__galeriku_tus_user';

// Whitelist MIME types (PRD §11 & §12.4 US-18).
// JPEG, PNG, WebP, GIF, HEIC, MP4, MOV, WebM. SVG ditolak.
export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

export const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export const WHITELIST_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
]);

export const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
]);

export const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'm4v']);

export const WHITELIST_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
]);

export const FORBIDDEN_EXTENSIONS = new Set([
  'svg',
  'html',
  'htm',
  'exe',
  'sh',
  'bat',
  'cmd',
  'php',
  'js',
  'ts',
]);
