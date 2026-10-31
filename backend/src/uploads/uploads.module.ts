import { Module } from '@nestjs/common';
import { ThumbnailService } from './thumbnail.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, ThumbnailService],
  exports: [UploadsService, ThumbnailService],
})
export class UploadsModule {}
