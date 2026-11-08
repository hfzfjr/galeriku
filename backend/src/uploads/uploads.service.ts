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
import { MetadataService } from './metadata.service';
import { PlaceService } from './place.service';
import { ThumbnailService } from './thumbnail.service';
import { VideoProcessingService } from './video-processing.service';
import { detectMotionPhoto } from './motion-photo';
import {
  TUS_AUTH_USER_KEY,
  TUS_OWNER_METADATA_KEY,
  TUS_ROUTE_PATH,
  TUS_SERVER_MAX_SIZE_BYTES,
} from './uploads.constants';
import { mapTus404ToStandard } from './uploads.errors';
import {
  checkDiskGuard,
  checkUserQuotaAndStatus,
  resolveMediaDir,
  sanitizeOriginalName,
  sniffAndValidateFile,
  TUS_ORPHAN_TTL_MS,
  tusDirOf,
  validateUploadMetadata,
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

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private server: Server | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly thumbnail: ThumbnailService,
    private readonly metadataService: MetadataService,
    private readonly placeService: PlaceService,
    private readonly videoProcessing: VideoProcessingService,
  ) {}

  onModuleInit(): void {
    const mediaDir = resolveMediaDir();
    const directory = tusDirOf(mediaDir);
    mkdirSync(mediaDir, { recursive: true });
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
      maxSize: Number(this.config.uploadMaxVideoBytes) || TUS_SERVER_MAX_SIZE_BYTES,
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
      onUploadCreate: (req, upload) => this.handleUploadCreate(req, upload),
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

  // Pembuatan upload (US-18): validasi metadata klien (SVG ditolak, whitelist
  // ekstensi/tipe, batas per tipe foto 25 MB / video 2 GB), disk guard (sisa disk
  // >= 15 GB), status akun, dan kuota pengguna. ownerId ditulis sisi server.
  private async handleUploadCreate(
    req: unknown,
    upload: {
      size?: number;
      metadata?: Record<string, string | null> | undefined;
    },
  ): Promise<{ metadata: Record<string, string | null> }> {
    const user = readTusAuthUser(req);
    if (!user) {
      throw { status_code: 401, body: UNAUTHENTICATED_BODY };
    }

    const uploadSize =
      upload.size !== undefined && upload.size !== null
        ? BigInt(upload.size)
        : undefined;

    // 1. Validasi metadata kiriman klien (SVG ditolak, whitelist, batas ukuran)
    const { originalName } = validateUploadMetadata(
      upload.metadata,
      uploadSize,
      this.config.uploadMaxImageBytes,
      this.config.uploadMaxVideoBytes,
    );

    // 2. Disk Guard: sisa ruang disk server minimal 15 GB (PRD §11 & §12.4)
    checkDiskGuard(
      resolveMediaDir(),
      uploadSize ?? 0n,
      this.config.diskGuardMinFreeBytes,
    );

    // 3. Status akun & kuota pengguna (PRD §11 & §12.4)
    await checkUserQuotaAndStatus(
      user.id,
      uploadSize ?? 0n,
      this.prisma,
    );

    return {
      metadata: {
        ...upload.metadata,
        filename: originalName,
        [TUS_OWNER_METADATA_KEY]: user.id,
      },
    };
  }

  // Dipakai job cleanup (upload-cleanup.service): hapus upload yatim
  // (tak selesai >24 jam) beserta sidecar-nya. Mengembalikan hitungan.
  async deleteExpiredUploads(): Promise<number> {
    return this.getServer().datastore.deleteExpired();
  }

  // Penyelesaian upload (US-17 & US-18):
  // 1. Validasi MIME sniffing dengan file-type pada berkas aktual di disk
  //    (memastikan tipe masuk whitelist: JPEG/PNG/WebP/GIF/HEIC/MP4/MOV/WebM; SVG ditolak).
  // 2. Verifikasi ulang ukuran aktual terhadap batas tipe.
  // 3. Pindahkan MEDIA_DIR/_tus/<uuid> -> MEDIA_DIR/<uuid> (storage_key = UUID).
  // 4. Buat baris File status ready.
  // Aman atomik: bila gagal sniff atau tulis DB, berkas segera dibersihkan.
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
    const sidecar = join(tusDir, `${storageKey}.json`);

    // 1. MIME sniffing & validasi file aktual di disk (US-18)
    let sniffed: { mime: string; kind: 'image' | 'video' };
    try {
      sniffed = await sniffAndValidateFile(
        asal,
        this.config.uploadMaxImageBytes,
        this.config.uploadMaxVideoBytes,
      );
    } catch (error) {
      await rm(asal, { force: true });
      await rm(sidecar, { force: true });
      this.logger.warn(
        `Upload ${storageKey} ditolak saat validasi MIME sniffing: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );
      throw error;
    }

    const ukuran = upload.size ?? upload.offset;

    // 2. Cek ulang kuota terhadap ukuran aktual (US-18)
    await checkUserQuotaAndStatus(user.id, BigInt(ukuran), this.prisma);

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

    // Sidecar <uuid>.json tak lagi dibutuhkan
    try {
      await rm(sidecar, { force: true });
    } catch (error) {
      this.logger.warn(
        `Sidecar ${storageKey}.json gagal dihapus: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // 3. Pembuatan thumbnail WebP (US-19) dan preview 2048px (RF-11) untuk foto
    let thumbKey: string | null = null;
    let previewKey: string | null = null;
    let width: number | null = null;
    let height: number | null = null;

    if (sniffed.kind === 'image') {
      const thumbFilename = `${storageKey}.thumb.webp`;
      const thumbPath = join(mediaDir, thumbFilename);
      const previewFilename = `${storageKey}.preview.webp`;
      const previewPath = join(mediaDir, previewFilename);
      const variantsRes = await this.thumbnail.generatePhotoVariants(
        tujuan,
        thumbPath,
        previewPath,
      );
      if (variantsRes) {
        thumbKey = variantsRes.thumbKey;
        previewKey = variantsRes.previewKey;
        width = variantsRes.width ?? null;
        height = variantsRes.height ?? null;
      }
    }

    // 4. Ekstraksi metadata (RF-10: tanggal pengambilan, GPS, kamera, dimensi)
    const rawClientMod = upload.metadata?.['lastModified'];
    const clientLastModified = rawClientMod ? Number(rawClientMod) : null;
    const meta = await this.metadataService.extractMetadata({
      filePath: tujuan,
      originalName,
      mimeType: sniffed.mime,
      clientLastModified,
      fallbackWidth: width,
      fallbackHeight: height,
    });

    const finalWidth = meta.width ?? width;
    const finalHeight = meta.height ?? height;
    const place = this.placeService.resolve(meta.gpsLat, meta.gpsLng);

    // RF-31: Deteksi Motion Photo Android jika berkas JPEG
    let liveKind: 'none' | 'motion' | 'ios_pair' = 'none';
    let liveOffset: bigint | null = null;
    let liveLength: bigint | null = null;
    if (sniffed.mime === 'image/jpeg') {
      const motion = await detectMotionPhoto(tujuan, ukuran);
      if (motion.isMotion && motion.offset && motion.length) {
        liveKind = 'motion';
        liveOffset = motion.offset;
        liveLength = motion.length;
      }
    }

    // RF-32: Pairing Live Photo iOS (ContentIdentifier)
    const contentId = meta.contentIdentifier;
    const liveGroupId: string | null = contentId ?? null;
    let liveVideoKey: string | null = null;

    if (sniffed.kind === 'video' && contentId) {
      // Bila MOV tiba dan foto pasangan sudah ada -> isi liveVideoKey pada foto
      const partnerPhoto = await this.prisma.file.findFirst({
        where: {
          ownerId: user.id,
          liveGroupId: contentId,
          kind: 'image',
          deletedAt: null,
        },
      });

      if (partnerPhoto) {
        await this.prisma.file.update({
          where: { id: partnerPhoto.id },
          data: {
            liveKind: 'ios_pair',
            liveVideoKey: storageKey,
            sizeBytes: partnerPhoto.sizeBytes + BigInt(ukuran),
          },
        });
        // Tidak membuat baris File baru untuk MOV yang sudah digabung
        return {};
      }
    }

    let initialSizeBytes = BigInt(ukuran);

    if (sniffed.kind === 'image' && contentId) {
      // Bila foto tiba dan MOV yatim sudah ada -> gabungkan dan hapus baris DB MOV
      const orphanMov = await this.prisma.file.findFirst({
        where: {
          ownerId: user.id,
          liveGroupId: contentId,
          kind: 'video',
          deletedAt: null,
        },
      });

      if (orphanMov) {
        liveKind = 'ios_pair';
        liveVideoKey = orphanMov.storageKey;
        initialSizeBytes = BigInt(ukuran) + orphanMov.sizeBytes;

        await this.prisma.file.delete({ where: { id: orphanMov.id } });
        if (orphanMov.thumbKey) {
          await rm(join(mediaDir, orphanMov.thumbKey), { force: true }).catch(() => {});
        }
      }
    }

    let createdFile: { id: string } | undefined;
    try {
      createdFile = await this.prisma.file.create({
        data: {
          ownerId: user.id,
          originalName,
          storageKey,
          mimeType: sniffed.mime,
          sizeBytes: initialSizeBytes,
          kind: sniffed.kind,
          thumbKey,
          previewKey,
          width: finalWidth,
          height: finalHeight,
          durationS: meta.durationS ?? null,
          capturedAt: meta.capturedAt,
          capturedTzOffsetMin: meta.capturedTzOffsetMin,
          capturedAtSource: meta.capturedAtSource as any,
          gpsLat: meta.gpsLat,
          gpsLng: meta.gpsLng,
          gpsAltM: meta.gpsAltM,
          placeCountry: place?.country ?? null,
          placeAdmin1: place?.admin1 ?? null,
          placeCity: place?.city ?? null,
          cameraMake: meta.cameraMake,
          cameraModel: meta.cameraModel,
          lensModel: meta.lensModel,
          iso: meta.iso,
          fNumber: meta.fNumber,
          exposureS: meta.exposureS,
          focalLengthMm: meta.focalLengthMm,
          orientation: meta.orientation,
          liveKind: liveKind as any,
          liveGroupId,
          liveVideoKey,
          liveOffset,
          liveLength,
          metaVersion: 1,
          status: FileStatus.ready,
        },
        select: { id: true },
      });
    } catch (error) {
      await rm(tujuan, { force: true });
      if (thumbKey) {
        await rm(join(mediaDir, thumbKey), { force: true });
      }
      if (previewKey) {
        await rm(join(mediaDir, previewKey), { force: true });
      }
      this.logger.warn(
        `Baris File ${storageKey} gagal dibuat, berkas final dibersihkan: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw {
        status_code: 500,
        body: JSON.stringify({
          statusCode: 500,
          code: 'UPLOAD_FINISH_FAILED',
          message: 'Upload selesai tapi gagal dicatat. Coba unggah ulang.',
        }),
      };
    }

    // Antrian pembuatan poster video di background konkurensi 1 (RF-34)
    if (sniffed.kind === 'video' && createdFile) {
      this.videoProcessing.enqueuePosterGeneration(
        createdFile.id,
        storageKey,
        tujuan,
        meta.durationS,
      );
    }

    return {};
  }
}
