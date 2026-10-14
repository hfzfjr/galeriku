# Deploy Backend via Coolify

Backend Galeriku jalan sebagai resource Docker Compose di Coolify
(resource "galeriku-backend"). Inilah satu-satunya sumber kebenaran
deploy backend.

## Pengaturan resource di UI Coolify

- Sumber: GitHub App, repo `hfzfjr/galeriku`, branch `main`.
- Build strategy: Compose.
- Base Directory: `/infrastructure`.
- Docker Compose Location: `/docker-compose.yml`.
- Domain: di service `backend`, `http://galeriku-api.hafizfajar.com:4000`.
- Auto Deploy menyala (Configuration > Advanced > Deployment & Git); sumber GitHub App sehingga push ke main memicu deploy lewat webhook.
- Route tunnel `galeriku-api.hafizfajar.com` ->
  `http://localhost:80` (proxy Traefik Coolify).

## Watch Paths

Diatur di Configuration > General > Build, satu pola per baris:

```text
backend/**
packages/**
infrastructure/**
pnpm-lock.yaml
pnpm-workspace.yaml
package.json
```

Perubahan di luar pola ini (mis. `frontend/**`, `docs/**`)
tidak memicu build ulang backend. Watch Paths hanya menyaring
event webhook Git, TIDAK memblokir tombol Deploy/Redeploy manual
atau Deploy Webhook berotentikasi.

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

## Deploy dan rollback via Coolify

Deploy lewat Coolify (tombol Deploy di resource "galeriku-backend").
Cek cepat pasca-deploy, berurutan:

1. `GET /health` ok dan database up.
2. `GET /auth/me` tanpa sesi -> 401.
3. `GET /admin/users` tanpa sesi -> 401.
4. Route tak dikenal -> `NOT_FOUND`.

### Pemantauan

Lihat hasil di Coolify > galeriku-backend > Deployments, baca
Deployment Logs; migrasi Prisma gagal berarti container keluar dan
deploy ditandai gagal.

### Rollback

Perbaikan terbaik = `git revert` commit bermasalah di `main` lalu
push (auto-deploy jalan lagi) atau Redeploy manual. Deploy Compose
di Coolify TIDAK memakai penggantian rolling, jadi layanan bisa mati
sebentar selama deploy dan bisa tetap mati bila deploy gagal.

Catatan rollback ke stack lama (HAPUS catatan ini saat tugas
pembersihan volume lama selesai): kembalikan route tunnel ke
`http://localhost:4000`, lalu `docker start galeriku-postgres
galeriku-backend`. Container dan volume lama
(`galeriku_galeriku_pgdata`) masih ada sebagai cadangan.
