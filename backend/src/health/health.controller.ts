import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { statfsSync } from 'node:fs';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const mediaDir = process.env.MEDIA_DIR ?? process.cwd();
      const stat = statfsSync(mediaDir);
      const diskFreeBytes = Number(stat.bavail) * Number(stat.bsize);
      const diskTotalBytes = Number(stat.blocks) * Number(stat.bsize);
      const diskFreePercent =
        diskTotalBytes > 0
          ? Math.round((diskFreeBytes / diskTotalBytes) * 100)
          : 0;

      return {
        status: 'ok',
        database: 'up',
        diskFreeBytes,
        diskTotalBytes,
        diskFreePercent,
        diskWarning: diskFreePercent < 20,
      };
    } catch {
      // Jangan bocorkan detail error internal ke respons.
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
  }
}
