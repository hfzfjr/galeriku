// Konstanta spike tus US-16. Layout final (_tus vs per-user) diputuskan di
// US-17; batas per tipe (foto 25 MB / video 2 GB) diputuskan di US-18.
export const TUS_ROUTE_PATH = '/uploads';

// Batas global spike: 2 GB (2147483648). Cukup untuk prototipe 100 MB dan
// sesuai batas video v1.0. Batas per tipe BELUM ditegakkan di spike.
export const TUS_SPIKE_MAX_SIZE_BYTES = 2147483648;

// Kunci metadata tus untuk pemilik upload. Ditulis sisi server di
// onUploadCreate (menimpa bila klien mengirim kunci yang sama).
export const TUS_OWNER_METADATA_KEY = 'ownerId';

// Kunci titipan SessionUser di objek request mentah Node (IncomingMessage)
// agar hook @tus/server (yang hanya menerima web Request) bisa membaca
// hasil guard Nest. Diisi controller SETELAH guard lolos.
export const TUS_AUTH_USER_KEY = '__galeriku_tus_user';

// Usulan env batas per tipe (US-18), BELUM dipakai di spike:
// UPLOAD_MAX_IMAGE_BYTES=26214400 (25 MB), UPLOAD_MAX_VIDEO_BYTES=2147483648.
