import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

// Concurrency limiter murni (US-19): membatasi jumlah pemrosesan gambar
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

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  readonly limiter = new ConcurrencyLimiter(2);

  constructor() {
    sharp.cache(false);
  }

  // Membuat thumbnail WebP ±400px (PRD §12.4 US-19):
  // - Orientasi EXIF dihormati via .rotate() bawaan sharp.
  // - Ukuran disesuaikan di dalam batas 400x400 tanpa pembesaran (withoutEnlargement).
  // - Format WebP dengan kualitas seimbang (80).
  // - Konkurensi dibatasi <= 2.
  async generatePhotoThumbnail(
    inputPath: string,
    outputPath: string,
  ): Promise<PhotoThumbnailResult | null> {
    return this.limiter.run(async () => {
      try {
        const pipeline = sharp(inputPath);
        const meta = await pipeline.metadata();

        await sharp(inputPath)
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
      }
    });
  }
}

