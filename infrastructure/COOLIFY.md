# Deploy Backend via Coolify

Backend Galeriku jalan sebagai resource Docker Compose di Coolify.
`deploy.sh` di akar repo DEPRECATED setelah cutover berhasil dan akan
dihapus lewat commit terpisah; ia tidak kompatibel dengan compose terbaru
(tanpa `container_name` dan tanpa `ports`).

## Pengaturan resource di UI Coolify

- Sumber: Git, repo `hfzfjr/galeriku`, branch `main`.
- Build pack: Docker Compose.
- Base Directory: `/`.
- Docker Compose Location: `/infrastructure/docker-compose.yml`.
- Domain: `http://galeriku-api.hafizfajar.com:4000`.
- Auto-deploy: MATIKAN dulu sampai cutover berhasil dan dicek.

## Variabel environment (isi nama-nama ini di UI Coolify)

Wajib (deploy diblokir bila kosong): `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB`, `FRONTEND_ORIGIN`, `ADMIN_EMAIL`,
`DEFAULT_QUOTA_BYTES`, `IP_HASH_SECRET`, `TURNSTILE_SECRET_KEY`,
`MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `MEDIA_HOST_DIR`.
Opsional: `CONTACT_EMAIL`.

## Prasyarat host (sebelum deploy pertama)

Folder media harus sudah ada dan dimiliki uid 1000 (user `node` di
container menulis ke sana):

```sh
mkdir -p /home/hafiz/galeriku-data/media
chown 1000:1000 /home/hafiz/galeriku-data/media
```

Database di Coolify baru dan kosong; migrasi Prisma jalan otomatis saat
container backend start (lihat `CMD` di `backend/Dockerfile`). Migrasi
harus kompatibel mundur.

## Langkah cutover

1. Hentikan stack lama TANPA menghapus volume: `docker compose stop`
   (JANGAN `down -v`; volume `galeriku_pgdata` dipertahankan).
2. Deploy di Coolify, tunggu status sehat.
3. Ubah route tunnel `galeriku-api.hafizfajar.com` ke
   `http://localhost:80` (proxy Coolify).
4. Cek berurutan: `GET /health`, `GET /auth/me` (dengan cookie sesi),
   `GET /admin/users` (sebagai ADMIN).

## Rollback

1. Kembalikan route tunnel ke `http://localhost:4000`.
2. Nyalakan stack lama: `docker start galeriku-postgres galeriku-backend`.
3. Pertahankan volume dan container lama beberapa hari sebelum dihapus.
