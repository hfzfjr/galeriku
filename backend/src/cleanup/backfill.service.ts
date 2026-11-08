import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { FileKind, FileStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetadataService } from '../uploads/metadata.service';
import { PlaceService } from '../uploads/place.service';
import { ThumbnailService } from '../uploads/thumbnail.service';
import { VideoProcessingService } from '../uploads/video-processing.service';
import { computeFileSha256, resolveMediaDir } from '../uploads/uploads.utils';

export const CURRENT_META_VERSION = 1;

export interface BackfillOptions {
  batchSize?: number;
  delayMs?: number;
}

export interface BackfillResult {
  processed: number;
  skipped: number;
  errors: number;
}

@Injectable()
export class BackfillService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackfillService.name);
  private isRunning = false;
  private shouldStop = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metadataService: MetadataService,
    private readonly thumbnailService: ThumbnailService,
    private readonly placeService: PlaceService,
    @Optional()
    private readonly videoProcessing?: VideoProcessingService,
  ) {}

  onModuleInit(): void {
    if (process.env.BACKFILL_ENABLED === 'true') {
      this.logger.log(
        'BACKFILL_ENABLED=true terdeteksi. Memulai job backfill metadata di background...',
      );
      void this.runOnce().catch((err: unknown) => {
        this.logger.error(
          `Backfill gagal: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      });
    }
  }

  onModuleDestroy(): void {
    this.stop();
  }

  stop(): void {
    this.shouldStop = true;
  }

  async runOnce(options?: BackfillOptions): Promise<BackfillResult> {
    if (this.isRunning) {
      this.logger.warn('Job backfill sedang berjalan, lewati panggilan ganda.');
      return { processed: 0, skipped: 0, errors: 0 };
    }

    this.isRunning = true;
    this.shouldStop = false;

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    const batchSize = options?.batchSize ?? 100;
    const delayMs = options?.delayMs ?? 50;
    const mediaDir = resolveMediaDir();

    try {
      const files = await this.prisma.file.findMany({
        where: {
          status: FileStatus.ready,
          deletedAt: null,
          metaVersion: { lt: CURRENT_META_VERSION },
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });

      this.logger.log(`Backfill: ditemukan ${files.length} item untuk diproses.`);

      for (const file of files) {
        if (this.shouldStop) {
          this.logger.log('Job backfill dihentikan sesuai permintaan.');
          break;
        }

        const filePath = join(mediaDir, file.storageKey);

        if (!existsSync(filePath)) {
          this.logger.warn(
            `File fisik tidak ditemukan untuk id=${file.id} storageKey=${file.storageKey}. Melewati item.`,
          );
          skipped += 1;
          continue;
        }

        try {
          // 1. Ekstrak ulang metadata EXIF dan tanggal
          const meta = await this.metadataService.extractMetadata({
            filePath,
            originalName: file.originalName,
            mimeType: file.mimeType,
          });

          let thumbKey = file.thumbKey;
          let previewKey = file.previewKey;
          let finalWidth = meta.width ?? file.width;
          let finalHeight = meta.height ?? file.height;

          // 2. Buat thumbnail 400px dan preview 2048px bila berkas foto
          if (file.kind === FileKind.image) {
            try {
              const thumbFilename = `${file.storageKey}.thumb.webp`;
              const thumbPath = join(mediaDir, thumbFilename);
              const previewFilename = `${file.storageKey}.preview.webp`;
              const previewPath = join(mediaDir, previewFilename);

              const variants =
                await this.thumbnailService.generatePhotoVariants(
                  filePath,
                  thumbPath,
                  previewPath,
                );
              if (variants) {
                thumbKey = variants.thumbKey;
                previewKey = variants.previewKey;
                if (variants.width) finalWidth = variants.width;
                if (variants.height) finalHeight = variants.height;
              }
            } catch (thumbErr) {
              this.logger.warn(
                `Gagal membuat varian thumbnail/preview untuk id=${file.id}: ${
                  thumbErr instanceof Error ? thumbErr.message : 'unknown'
                }`,
              );
            }
          } else if (file.kind === FileKind.video && this.videoProcessing) {
            try {
              const thumbFilename = `${file.storageKey}.thumb.webp`;
              const thumbPath = join(mediaDir, thumbFilename);
              const ok = await this.videoProcessing.generatePoster(
                filePath,
                thumbPath,
                meta.durationS,
              );
              if (ok) {
                thumbKey = thumbFilename;
              }
            } catch (videoErr) {
              this.logger.warn(
                `Gagal membuat poster video backfill untuk id=${file.id}: ${
                  videoErr instanceof Error ? videoErr.message : 'unknown'
                }`,
              );
            }
          }

          const place = this.placeService.resolve(meta.gpsLat, meta.gpsLng);

          // Hitung SHA-256 & deteksi duplikat jika belum ada (RF-45)
          let contentHash = (file as { contentHash?: string | null }).contentHash ?? null;
          let duplicateOfId = (file as { duplicateOfId?: string | null }).duplicateOfId ?? null;
          if (!contentHash) {
            try {
              contentHash = await computeFileSha256(filePath);
              const existingDuplicate = await this.prisma.file.findFirst({
                where: {
                  ownerId: file.ownerId,
                  contentHash,
                  deletedAt: null,
                  status: FileStatus.ready,
                  id: { not: file.id },
                },
                orderBy: { createdAt: 'asc' },
                select: { id: true },
              });
              duplicateOfId = existingDuplicate?.id ?? null;
            } catch {
              // Lewati kalkulasi hash jika gagal
            }
          }

          // 3. Simpan pembaruan metadata ke basis data secara idempoten
          await this.prisma.file.update({
            where: { id: file.id },
            data: {
              capturedAt: meta.capturedAt,
              capturedTzOffsetMin: meta.capturedTzOffsetMin,
              capturedAtSource: meta.capturedAtSource,
              width: finalWidth,
              height: finalHeight,
              durationS: meta.durationS ?? file.durationS,
              orientation: meta.orientation,
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
              thumbKey,
              previewKey,
              contentHash,
              duplicateOfId,
              metaVersion: CURRENT_META_VERSION,
            },
          });

          processed += 1;

          // Jeda antar item agar RAM dan I/O tetap hemat & tidak membebani sistem
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        } catch (itemErr) {
          this.logger.error(
            `Error memproses backfill file id=${file.id}: ${
              itemErr instanceof Error ? itemErr.message : 'unknown'
            }`,
          );
          errors += 1;
        }
      }

      this.logger.log(
        `Backfill selesai: ${processed} diproses, ${skipped} dilewati, ${errors} gagal.`,
      );
    } finally {
      this.isRunning = false;
    }

    return { processed, skipped, errors };
  }
}
