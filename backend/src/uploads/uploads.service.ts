import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FileStore } from '@tus/file-store';
import { ERRORS, Server } from '@tus/server';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { SessionUser } from '../auth/guards/auth.guard';
import {
  TUS_AUTH_USER_KEY,
  TUS_OWNER_METADATA_KEY,
  TUS_ROUTE_PATH,
  TUS_SPIKE_MAX_SIZE_BYTES,
} from './uploads.constants';
import { mapTus404ToStandard } from './uploads.errors';

// Body galat standar bila hook tus dipanggil tanpa titipan sesi (tak
// terjadi lewat controller karena guard berjalan duluan; fail-closed).
// Pesan disamakan dengan SessionAuthGuard.
const UNAUTHENTICATED_BODY = JSON.stringify({
  statusCode: 401,
  code: 'UNAUTHENTICATED',
  message: 'Masuk dulu untuk melanjutkan.',
});

type RawWithUser = Record<string | symbol, unknown>;

// Hook @tus/server hanya menerima web Request; user dibaca dari request
// mentah Node yang dititipi controller (lihat UploadsController).
export function readTusAuthUser(req: unknown): SessionUser | undefined {
  const runtime = (req as { runtime?: { node?: { req?: unknown } } })?.runtime
    ?.node?.req;
  const stash = (runtime as RawWithUser | undefined)?.[TUS_AUTH_USER_KEY];
  if (typeof stash === 'object' && stash !== null) {
    const id = (stash as SessionUser).id;
    if (typeof id === 'string' && id.length > 0) {
      return stash as SessionUser;
    }
  }
  return undefined;
}

// Spike US-16: @tus/server di dalam NestJS (adapter Fastify). Autentikasi
// dan Origin TETAP lewat guard global Nest (SessionAuthGuard, OriginGuard)
// karena route didaftarkan sebagai controller; hook di sini hanya menegakkan
// kepemilikan (404 identik) dan menulis ownerId sisi server.
@Injectable()
export class UploadsService implements OnModuleInit {
  private server: Server | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    const directory = join(
      process.env.MEDIA_DIR?.trim() || process.cwd(),
      '_tus',
    );
    mkdirSync(directory, { recursive: true });
    this.server = new Server({
      path: TUS_ROUTE_PATH,
      datastore: new FileStore({ directory }),
      maxSize: TUS_SPIKE_MAX_SIZE_BYTES,
      // Location relatif (fix US-16): "/uploads/<uuid>" tanpa skema/host,
      // sehingga kebal terhadap header Forwarded/X-Forwarded-* dari rantai
      // proxy (Cloudflare -> cloudflared -> Traefik) yang hop terakhirnya
      // http dan membuat Location absolut berskema http:// (mixed content
      // di halaman https). tus-js-client me-resolve Location relatif
      // terhadap endpoint (new URL(location, endpoint)), jadi HEAD/PATCH
      // berikutnya tetap ke host API yang benar. respectForwardedHeaders
      // SENGAJA dimatikan: tak lagi dibutuhkan bila Location relatif.
      relativeLocation: true,
      allowedOrigins: [this.config.frontendOrigin],
      allowedCredentials: true,
      // Id upload = UUID (calon storage_key); tanpa slash sehingga
      // generateUrl/getFileIdFromRequest bawaan tetap berlaku.
      namingFunction: () => randomUUID(),
      onIncomingRequest: (req, uploadId) =>
        this.checkOwnership(req, uploadId),
      onUploadCreate: (req, upload) => this.attachOwner(req, upload),
      onResponseError: (_req, err) =>
        Promise.resolve(
          mapTus404ToStandard(
            err as { status_code?: unknown; body?: unknown },
          ),
        ),
    });
  }

  // Dipanggil controller dengan request/response mentah setelah
  // reply.hijack(). Header CORS actual-request ditulis @tus/server sendiri;
  // header yang di-stage @fastify/cors (onRequest) gugur saat hijack,
  // sehingga tidak ada header ganda. Preflight OPTIONS dijawab @fastify/cors
  // sebelum handler (lihat cors.ts).
  async handleRaw(
    rawReq: IncomingMessage,
    rawRes: ServerResponse,
  ): Promise<void> {
    await this.getServer().handle(rawReq, rawRes);
  }

  private getServer(): Server {
    if (!this.server) {
      throw new Error('Server tus belum diinisialisasi.');
    }
    return this.server;
  }

  // Kepemilikan (aturan 12 AGENTS.md): id milik pengguna lain dijawab 404
  // identik dengan id tak ada. Id tak ada dibiarkan lolos agar 404 alami
  // dari FileStore (disamakan ke JSON standar oleh onResponseError).
  private async checkOwnership(
    req: unknown,
    uploadId: string,
  ): Promise<void> {
    const method =
      typeof (req as { method?: unknown }).method === 'string'
        ? ((req as { method: string }).method.toUpperCase() ?? '')
        : '';
    if (
      method !== 'HEAD' &&
      method !== 'PATCH' &&
      method !== 'DELETE'
    ) {
      return;
    }
    if (!uploadId) {
      return;
    }
    const user = readTusAuthUser(req);
    if (!user) {
      throw { status_code: 401, body: UNAUTHENTICATED_BODY };
    }
    let existing: { metadata?: Record<string, string | null> | undefined };
    try {
      existing = await this.getServer().datastore.getUpload(uploadId);
    } catch (error) {
      if ((error as { status_code?: unknown })?.status_code === 404) {
        return;
      }
      throw error;
    }
    if (existing?.metadata?.[TUS_OWNER_METADATA_KEY] !== user.id) {
      throw { ...ERRORS.FILE_NOT_FOUND };
    }
  }

  // ownerId ditulis sisi server (menimpa kiriman klien bila ada).
  private async attachOwner(
    req: unknown,
    upload: { metadata?: Record<string, string | null> | undefined },
  ): Promise<{ metadata: Record<string, string | null> }> {
    const user = readTusAuthUser(req);
    if (!user) {
      throw { status_code: 401, body: UNAUTHENTICATED_BODY };
    }
    return {
      metadata: { ...upload.metadata, [TUS_OWNER_METADATA_KEY]: user.id },
    };
  }
}
