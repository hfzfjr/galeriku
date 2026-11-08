import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { PlaceService } from './place.service';
import { ThumbnailService } from './thumbnail.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { VideoProcessingService } from './video-processing.service';

@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    ThumbnailService,
    MetadataService,
    PlaceService,
    VideoProcessingService,
  ],
  exports: [
    UploadsService,
    ThumbnailService,
    MetadataService,
    PlaceService,
    VideoProcessingService,
  ],
})
export class UploadsModule {}
