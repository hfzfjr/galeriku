import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { FilesService } from '../files/files.service';

const HOUR_MS = 60 * 60 * 1000;

// Pembersihan sampah kadaluwarsa (RF-01): item di tempat sampah yang deletedAt > 30 hari
// (atau sesuai TRASH_RETENTION_DAYS) dihapus permanen beserta file fisiknya.
// Berjalan sekali saat start lalu tiap 1 jam (setInterval + unref, anti tumpang tindih, error ditangkap).
@Injectable()
export class TrashCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrashCleanupService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private readonly intervalMs = HOUR_MS;

  constructor(private readonly files: FilesService) {}

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  start(): void {
    void this.runOnce().catch((error: unknown) => {
      this.logger.warn(
        `Pembersihan sampah awal gagal: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    });
    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        this.logger.warn(
          `Pembersihan sampah berkala gagal: ${error instanceof Error ? error.message : 'unknown'}`,
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

  async runOnce(): Promise<{ files: number }> {
    if (this.running) {
      return { files: 0 };
    }
    this.running = true;
    try {
      const retentionDays =
        parseInt(process.env.TRASH_RETENTION_DAYS ?? '30', 10) || 30;
      const res = await this.files.purgeExpiredTrash(retentionDays);
      if (res.count > 0) {
        this.logger.log(
          `Pembersihan sampah: ${res.count} file kedaluwarsa dihapus permanen.`,
        );
      }
      return { files: res.count };
    } finally {
      this.running = false;
    }
  }
}

