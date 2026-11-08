-- CreateEnum
CREATE TYPE "CapturedAtSource" AS ENUM ('exif', 'video', 'filename', 'client_modified', 'upload', 'manual');

-- CreateEnum
CREATE TYPE "LiveKind" AS ENUM ('none', 'ios_pair', 'motion');

-- AlterTable
ALTER TABLE "files" ADD COLUMN "camera_make" TEXT,
ADD COLUMN "camera_model" TEXT,
ADD COLUMN "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "captured_at_source" "CapturedAtSource" NOT NULL DEFAULT 'upload',
ADD COLUMN "captured_tz_offset_min" INTEGER,
ADD COLUMN "content_hash" TEXT,
ADD COLUMN "duplicate_of_id" TEXT,
ADD COLUMN "exposure_s" DOUBLE PRECISION,
ADD COLUMN "f_number" DOUBLE PRECISION,
ADD COLUMN "focal_length_mm" DOUBLE PRECISION,
ADD COLUMN "gps_alt_m" DOUBLE PRECISION,
ADD COLUMN "gps_lat" DOUBLE PRECISION,
ADD COLUMN "gps_lng" DOUBLE PRECISION,
ADD COLUMN "iso" INTEGER,
ADD COLUMN "lens_model" TEXT,
ADD COLUMN "live_group_id" TEXT,
ADD COLUMN "live_kind" "LiveKind" NOT NULL DEFAULT 'none',
ADD COLUMN "live_length" BIGINT,
ADD COLUMN "live_offset" BIGINT,
ADD COLUMN "live_video_key" TEXT,
ADD COLUMN "meta_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "orientation" INTEGER,
ADD COLUMN "place_admin1" TEXT,
ADD COLUMN "place_city" TEXT,
ADD COLUMN "place_country" TEXT,
ADD COLUMN "preview_key" TEXT;

-- CreateIndex
CREATE INDEX "files_owner_id_captured_at_id_idx" ON "files"("owner_id", "captured_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "files_owner_id_content_hash_idx" ON "files"("owner_id", "content_hash");

-- CreateIndex
CREATE INDEX "files_owner_id_live_group_id_idx" ON "files"("owner_id", "live_group_id");

