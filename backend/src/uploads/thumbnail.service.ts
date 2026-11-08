import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

// Concurrency limiter murni (US-19 & RF-11): membatasi pemrosesan gambar
// konkruen maksimal 2 agar CPU/RAM server rumah tidak kewalahan.
export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number = 2) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  getActiveCount(): number {
    return this.active;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export type PhotoThumbnailResult = {
  thumbKey: string;
  width?: number;
  height?: number;
};

export type PhotoVariantsResult = {
  thumbKey: string;
  previewKey: string;
  width?: number;
  height?: number;
};

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  readonly limiter = new ConcurrencyLimiter(2);

  constructor() {
    sharp.cache(false);
  }

  // Menyiapkan path gambar yang bisa dibaca. Jika berformat HEIC/HEIF dan sharp
  // tidak bisa langsung mendecode codec-nya, gunakan `heif-convert` dari libheif.
  private async prepareReadableImagePath(
    inputPath: string,
  ): Promise<{ path: string; cleanup?: () => Promise<void> }> {
    const isHeic = /\.(heic|heif)$/i.test(inputPath);
    if (!isHeic) {
      return { path: inputPath };
    }

    try {
      await sharp(inputPath).metadata();
      return { path: inputPath };
    } catch (sharpError) {
      this.logger.debug(
        `Sharp gagal membaca HEIC langsung (${sharpError instanceof Error ? sharpError.message : String(sharpError)}), mencoba heif-convert...`,
      );
    }

    const tempConverted = `${inputPath}.${Date.now()}.converted.jpg`;
    try {
      await execFileAsync('heif-convert', [inputPath, tempConverted]);
      return {
        path: tempConverted,
        cleanup: async () => {
          await rm(tempConverted, { force: true }).catch(() => {});
        },
      };
    } catch (convertError) {
      this.logger.warn(
        `heif-convert gagal untuk ${inputPath}: ${convertError instanceof Error ? convertError.message : String(convertError)}`,
      );
      return { path: inputPath };
    }
  }

  // Membuat varian WebP (RF-11):
  // 1. Thumbnail ±400px (US-19)
  // 2. Preview sisi terpanjang maks 2048px kualitas ~82 tanpa metadata (RF-11)
  // - Orientasi EXIF dihormati via .rotate() bawaan sharp
  // - Konkurensi gabungan dibatasi <= 2
  async generatePhotoVariants(
    inputPath: string,
    thumbPath: string,
    previewPath: string,
  ): Promise<PhotoVariantsResult | null> {
    return this.limiter.run(async () => {
      let cleanupFn: (() => Promise<void>) | undefined;
      try {
        const prepared = await this.prepareReadableImagePath(inputPath);
        cleanupFn = prepared.cleanup;
        const processPath = prepared.path;

        const meta = await sharp(processPath).metadata();
        const orientation = meta.orientation ?? 1;
        const swapDimensions = orientation >= 5 && orientation <= 8;
        const effectiveWidth = swapDimensions ? meta.height : meta.width;
        const effectiveHeight = swapDimensions ? meta.width : meta.height;

        // 1. Thumbnail 400x400 inside, WebP q80
        await sharp(processPath)
          .rotate()
          .resize(400, 400, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toFile(thumbPath);

        // 2. Preview 2048x2048 inside, WebP q82, tanpa metadata
        await sharp(processPath)
          .rotate()
          .resize(2048, 2048, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toFile(previewPath);

        const thumbKey = thumbPath.split(/[\\/]/).pop() ?? '';
        const previewKey = previewPath.split(/[\\/]/).pop() ?? '';

        return {
          thumbKey,
          previewKey,
          width: effectiveWidth,
          height: effectiveHeight,
        };
      } catch (error) {
        this.logger.warn(
          `Gagal membuat varian gambar untuk ${inputPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      } finally {
        if (cleanupFn) {
          await cleanupFn();
        }
      }
    });
  }

  // Kompatibilitas mundur untuk pembuat thumbnail tunggal
  async generatePhotoThumbnail(
    inputPath: string,
    outputPath: string,
  ): Promise<PhotoThumbnailResult | null> {
    return this.limiter.run(async () => {
      let cleanupFn: (() => Promise<void>) | undefined;
      try {
        const prepared = await this.prepareReadableImagePath(inputPath);
        cleanupFn = prepared.cleanup;
        const processPath = prepared.path;

        const pipeline = sharp(processPath);
        const meta = await pipeline.metadata();

        await sharp(processPath)
          .rotate()
          .resize(400, 400, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toFile(outputPath);

        const thumbKey = outputPath.split(/[\\/]/).pop() ?? '';
        return {
          thumbKey,
          width: meta.width,
          height: meta.height,
        };
      } catch (error) {
        this.logger.warn(
          `Gagal membuat thumbnail untuk ${inputPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      } finally {
        if (cleanupFn) {
          await cleanupFn();
        }
      }
    });
  }
}

