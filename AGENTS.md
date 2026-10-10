# Galeriku

Personal cloud storage for sharing photos and videos through public links. Mobile-first. UI copy is in **Bahasa Indonesia**.

## Docs (read on demand, do not paste into context)

- `docs/PRD.md` is the product spec (Indonesian). Before a story, read the relevant parts: §8 architecture, §9 data model, §10 routes/endpoints, §11 security, §12.4 sprint stories and acceptance criteria.
- `docs/PROGRESS.md` is the story checklist (exact PRD titles). Read it at the start of every session.
- `docs/DESIGN.md` is the visual design spec. Read it before any UI work.

## Structure (pnpm workspaces monorepo)

- `frontend/`: Next.js (App Router, TypeScript, Tailwind). Deployed to Vercel (Root Directory `frontend`), domain `galeriku.hafizfajar.com`.
- `backend/`: NestJS (Fastify adapter), Prisma, PostgreSQL. Runs in Docker on a local Debian server behind a Cloudflare Tunnel, host `galeriku-api.hafizfajar.com`.
- `packages/`: optional shared code (for example Zod schemas in `packages/contracts`).
- `infrastructure/`: Docker Compose (`backend`, `postgres`), skrip deploy (`deploy.sh`), backup scripts. Tunnel Cloudflare (`cf-tunnel`) jalan sebagai layanan host dengan route ke `127.0.0.1:4000`, bukan container Compose.
- `docs/`: PRD and design spec.

Do not rename these folders.

## Commands (run from the repo root)

- `pnpm install`
- `pnpm dev:frontend` (port 3000), `pnpm dev:backend` (port 4000)
- `pnpm build:frontend`, `pnpm build:backend`
- `pnpm --filter backend test` (unit tests), `pnpm --filter backend test:e2e`
- Use Node LTS (24.x) and pnpm only. Do not use npm or yarn.

## Workflow

- Work one sprint story at a time, exactly the story I name. Meet its acceptance criteria and do not add features outside the PRD.
- Ask before adding a dependency that the PRD does not mention.
- Finish a story only after build, lint, and relevant tests pass. For UI work, also check a 360x800 viewport.
- Keep commits small, one story per branch.
- Centang story di docs/PROGRESS.md pada commit terakhir story tersebut

## Architecture rules (do not violate)

1. **Auth lives only in the backend.** No Auth.js/NextAuth. Sessions are server-side in PostgreSQL. The cookie is `HttpOnly; Secure; SameSite=Lax`, host-only on the API host. Never store tokens in localStorage/sessionStorage or expose them to JavaScript.
2. **All authorization is enforced in the backend on every request** (session, role, ownership, quota). Frontend checks are for UX only. Default deny: routes are protected unless explicitly marked public.
3. **Access model:** anonymous users can only open and download through public share links. Upload, personal gallery, and album/link management require login. Login works with email + password (argon2id) or Google OAuth. Registration is invite-only (allowlist). One email equals one account.
4. **File bytes never pass through Vercel or Next.js** (4.5 MB function body limit). The browser talks directly to the API host for upload (tus, 5 MB chunks), thumbnails, streaming (HTTP Range), and downloads. Next.js only renders UI and fetches JSON.
5. **Frontend and API stay same-site** (both under `hafizfajar.com`). The API host must be a first-level subdomain. CORS allows only the frontend origin with credentials, and mutating requests verify the `Origin` header.
6. **Private pages (`/app/*`) render on the client**, because the session cookie belongs to the API host. Only the landing page and `/s/[token]` use static/SSR rendering.
7. **Files live on local disk behind a `StorageAdapter`;** the database stores metadata only. Never use original file names on disk (use a UUID `storage_key`).
8. **Validate file types by MIME sniffing** against the whitelist (JPEG, PNG, WebP, GIF, HEIC, MP4, MOV, WebM). Reject SVG. Enforce per-user quota and a disk guard (reject uploads when free disk is below 15 GB).
9. **Share tokens** are 32 random bytes, base64url. Public and login endpoints are rate limited. Public pages are `noindex`; only the landing page is indexable.
10. **Configuration comes from env** (`NEXT_PUBLIC_API_URL`, `FRONTEND_ORIGIN`, and so on). Never hardcode domains. Never commit `.env*` files except `.env.example`.
11. Auth error messages must not reveal whether an email exists.

## Code conventions

- TypeScript strict mode. Validate all input at the API boundary (Zod or class-validator).
- Backend: one NestJS module per domain (`auth`, `users`, `files`, `albums`, `shares`, `uploads`, `admin`). Prisma for the database, with migrations through Prisma Migrate.
- Frontend: TanStack Query for data, `credentials: 'include'` on API calls, Tailwind with the tokens from `docs/DESIGN.md`.
- Mobile-first: design at 360 px, touch targets of at least 44 px, respect safe-area insets, use `100dvh` instead of `100vh`.
- BigInt columns (file sizes, quotas) must never be sent raw in JSON; always serialize them as strings in DTOs and responses.

## UI rules

- Follow `docs/DESIGN.md` strictly (colors, fonts, spacing, radius).
- No default shadcn look, no purple/blue gradients, no emoji as icons, no generic marketing copy. Write real Indonesian copy.

## Out of scope for v1.0

- Do not proxy uploads or downloads through Next.js route handlers.
- Do not add Redis, MinIO, or a separate tus server. Video processing (ffmpeg, transcode, job queue) is Phase 2.
