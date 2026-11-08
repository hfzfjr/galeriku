import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { PlaceService } from './place.service';
import { ThumbnailService } from './thumbnail.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, ThumbnailService, MetadataService, PlaceService],
  exports: [UploadsService, ThumbnailService, MetadataService, PlaceService],
})
export class UploadsModule {}
