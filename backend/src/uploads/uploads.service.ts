import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FileStore } from '@tus/file-store';
import { ERRORS, Server } from '@tus/server';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { SessionUser } from '../auth/guards/auth.guard';
import { FileStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TUS_AUTH_USER_KEY,
  TUS_OWNER_METADATA_KEY,
  TUS_ROUTE_PATH,
  TUS_SPIKE_MAX_SIZE_BYTES,
} from './uploads.constants';
import { mapTus404ToStandard } from './uploads.errors';
import {
  inferKind,
  resolveMediaDir,
  sanitizeOriginalName,
  TUS_ORPHAN_TTL_MS,
  tusDirOf,
} from './uploads.utils';

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
  private readonly logger = new Logger(UploadsService.name);
  private server: Server | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    const directory = tusDirOf(resolveMediaDir());
    mkdirSync(directory, { recursive: true });
    this.server = new Server({
      path: TUS_ROUTE_PATH,
      // expiration 24 jam (US-17): upload tak selesai lebih lama dari
      // ini dihapus job cleanup via deleteExpired(); upload selesai
      // (offset == size) TIDAK ikut terhapus.
      datastore: new FileStore({
        directory,
        expirationPeriodInMilliseconds: TUS_ORPHAN_TTL_MS,
      }),
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
      onUploadFinish: (req, upload) => this.finishUpload(req, upload),
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

  // Dipakai job cleanup (upload-cleanup.service): hapus upload yatim
  // (tak selesai >24 jam) beserta sidecar-nya. Mengembalikan hitungan.
  async deleteExpiredUploads(): Promise<number> {
    return this.getServer().datastore.deleteExpired();
  }

  // Penyelesaian upload (US-17): pindahkan
  // MEDIA_DIR/_tus/<uuid> -> MEDIA_DIR/<uuid> (storage_key = UUID,
  // bukan nama asli) lalu buat baris File status ready. Validasi
  // MIME/kuota/disk guard BELUM ada (US-18): semua tipe diterima.
  // Aman: bila tulis DB gagal setelah file pindah, file final dihapus
  // lagi agar tak jadi yatim tanpa baris DB.
  private async finishUpload(
    req: unknown,
    upload: {
      id: string;
      size?: number;
      offset: number;
      metadata?: Record<string, string | null> | undefined;
    },
  ): Promise<Record<string, never>> {
    const user = readTusAuthUser(req);
    if (!user) {
      throw { status_code: 401, body: UNAUTHENTICATED_BODY };
    }
    const mediaDir = resolveMediaDir();
    const tusDir = tusDirOf(mediaDir);
    const storageKey = upload.id;
    const asal = join(tusDir, storageKey);
    const tujuan = join(mediaDir, storageKey);
    const mentah = upload.metadata?.['filename'];
    const originalName = sanitizeOriginalName(mentah);
    const mimeType =
      typeof upload.metadata?.['filetype'] === 'string' &&
      upload.metadata['filetype'].length > 0
        ? upload.metadata['filetype']
        : 'application/octet-stream';
    const ukuran = upload.size ?? upload.offset;
    try {
      await rename(asal, tujuan);
    } catch (error) {
      this.logger.warn(
        `Upload ${storageKey} milik ${user.id} selesai tapi berkas tus tak ada: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw {
        status_code: 500,
        body: JSON.stringify({
          statusCode: 500,
          code: 'UPLOAD_FINISH_FAILED',
          message: 'Upload selesai tapi berkasnya hilang. Coba unggah ulang.',
        }),
      };
    }
    // Sidecar <uuid>.json tak lagi dibutuhkan (upload sudah selesai dan
    // tak ikut deleteExpired); kegagalan menghapusnya hanya dicatat.
    try {
      await rm(join(tusDir, `${storageKey}.json`), { force: true });
    } catch (error) {
      this.logger.warn(
        `Sidecar ${storageKey}.json gagal dihapus: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      await this.prisma.file.create({
        data: {
          ownerId: user.id,
          originalName,
          storageKey,
          mimeType,
          sizeBytes: BigInt(ukuran),
          kind: inferKind(mimeType, originalName),
          status: FileStatus.ready,
        },
      });
    } catch (error) {
      await rm(tujuan, { force: true });
      this.logger.warn(
        `Baris File ${storageKey} gagal dibuat, berkas final dibersihkan: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw {
        status_code: 500,
        body: JSON.stringify({
          statusCode: 500,
          code: 'UPLOAD_FINISH_FAILED',
          message: 'Upload selesai tapi gagal disimpan. Coba unggah ulang.',
        }),
      };
    }
    return {};
  }
}
