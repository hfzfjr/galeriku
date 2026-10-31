import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { UploadsService } from '../uploads/uploads.service';

const HOUR_MS = 60 * 60 * 1000;

// Pembersihan upload yatim (US-17): upload tus yang tak selesai >24 jam
// dihapus lewat ekstensi expiration FileStore (deleteExpired hanya
// menyentuh upload yang belum selesai; upload selesai sudah dipindah ke
// MEDIA_DIR/<uuid> oleh onUploadFinish). Jalan sekali saat start lalu
// tiap 1 jam (setInterval + unref, anti tumpang tindih, error ditangkap).
// Sisa file uji lama di _tus ikut terbersihkan mekanisme ini.
@Injectable()
export class UploadCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadCleanupService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private readonly intervalMs = HOUR_MS;

  constructor(private readonly uploads: UploadsService) {}

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  start(): void {
    void this.runOnce().catch((error: unknown) => {
      this.logger.warn(
        `Pembersihan upload awal gagal: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    });
    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        this.logger.warn(
          `Pembersihan upload berkala gagal: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      });
    }, this.intervalMs);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async runOnce(): Promise<{ uploads: number }> {
    if (this.running) {
      return { uploads: 0 };
    }
    this.running = true;
    try {
      const uploads = await this.uploads.deleteExpiredUploads();
      if (uploads > 0) {
        this.logger.log(`Pembersihan upload: ${uploads} upload yatim dihapus.`);
      }
      return { uploads };
    } finally {
      this.running = false;
    }
  }
}
