import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

// Spike US-16. APP_CONFIG dan PrismaService global; guard auth/origin
// global dari AuthModule. file-type dan sharp terpasang (pin persis) untuk
// US-18/US-19, belum dipakai di sini.
@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
