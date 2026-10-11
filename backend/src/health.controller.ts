import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { statfsSync } from 'node:fs';
import { Public } from './auth/public.decorator';
import { PrismaService } from './prisma.service';

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
      return {
        status: 'ok',
        database: 'up',
        diskFreeBytes: Number(stat.bavail) * Number(stat.bsize),
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
