import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const HOUR_MS = 60 * 60 * 1000;
const UNVERIFIED_TTL_MS = 24 * HOUR_MS;
const EXPIRED_CODE_TTL_MS = 24 * HOUR_MS;

// Pembersihan otomatis tanpa dependency: jalan sekali saat start lalu
// tiap 1 jam (setInterval + unref agar tak menahan proses, anti tumpang
// tindih, error ditangkap). Menghapus:
// - user belum terverifikasi yang dibuat > 24 jam lalu (beserta sesi dan
//   email_codes berdasarkan email lebih dulu);
// - email_codes yang kedaluwarsa > 1 hari.
// Log hanya berisi hitungan (tanpa email/kode apa pun).
@Injectable()
export class AccountCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AccountCleanupService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private readonly intervalMs = HOUR_MS;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  start(): void {
    void this.runOnce().catch((error: unknown) => {
      this.logger.warn(
        `Pembersihan awal gagal: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    });
    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        this.logger.warn(
          `Pembersihan berkala gagal: ${error instanceof Error ? error.message : 'unknown'}`,
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

  async runOnce(now: Date = new Date()): Promise<{ users: number; codes: number }> {
    if (this.running) {
      return { users: 0, codes: 0 };
    }
    this.running = true;
    try {
      const staleUsers = await this.prisma.user.findMany({
        where: {
          emailVerifiedAt: null,
          createdAt: { lt: new Date(now.getTime() - UNVERIFIED_TTL_MS) },
        },
        select: { id: true, email: true },
      });
      let users = 0;
      if (staleUsers.length > 0) {
        const ids = staleUsers.map((u) => u.id);
        const emails = staleUsers.map((u) => u.email);
        await this.prisma.session.deleteMany({
          where: { userId: { in: ids } },
        });
        await this.prisma.emailCode.deleteMany({
          where: { email: { in: emails } },
        });
        const deleted = await this.prisma.user.deleteMany({
          where: { id: { in: ids } },
        });
        users = deleted.count;
      }
      const codes = await this.prisma.emailCode.deleteMany({
        where: {
          expiresAt: { lt: new Date(now.getTime() - EXPIRED_CODE_TTL_MS) },
        },
      });
      if (users > 0 || codes.count > 0) {
        this.logger.log(
          `Pembersihan: ${users} akun dan ${codes.count} kode dihapus.`,
        );
      }
      return { users, codes: codes.count };
    } finally {
      this.running = false;
    }
  }
}
