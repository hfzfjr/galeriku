import { Injectable, Logger, Optional } from '@nestjs/common';
import exifr from 'exifr';
import sharp from 'sharp';
import {
  VideoProcessingService,
  type VideoProbeResult,
} from './video-processing.service';

export interface ExtractedMetadata {
  capturedAt: Date;
  capturedTzOffsetMin: number | null;
  capturedAtSource: 'exif' | 'video' | 'filename' | 'client_modified' | 'upload' | 'manual';
  width: number | null;
  height: number | null;
  durationS: number | null;
  orientation: number | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAltM: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  iso: number | null;
  fNumber: number | null;
  exposureS: number | null;
  focalLengthMm: number | null;
}

export interface ExtractMetadataOptions {
  filePath: string;
  originalName: string;
  mimeType: string;
  clientLastModified?: number | null;
  fallbackWidth?: number | null;
  fallbackHeight?: number | null;
}

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    @Optional()
    private readonly videoProcessing?: VideoProcessingService,
  ) {}

  /**
   * Mengurai tanggal dari pola nama berkas kamera/ponsel populer.
   */
  parseFilenameDate(filename: string): Date | null {
    const base = filename.replace(/\.[^.]+$/, '');

    // 1. Pola WhatsApp: IMG-YYYYMMDD-WA#### atau VID-YYYYMMDD-WA####
    const waMatch = base.match(/^(?:IMG|VID)-(\d{4})(\d{2})(\d{2})-WA\d+$/i);
    if (waMatch) {
      const year = Number(waMatch[1]);
      const month = Number(waMatch[2]) - 1;
      const day = Number(waMatch[3]);
      if (this.isValidDateValues(year, month, day)) {
        return new Date(year, month, day, 0, 0, 0);
      }
    }

    // 2. Pola IMG_YYYYMMDD_HHMMSS / VID_YYYYMMDD_HHMMSS / PXL_YYYYMMDD_HHMMSS
    const stdMatch = base.match(
      /^(?:IMG|VID|PXL|Screenshot)[_-](\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/i,
    );
    if (stdMatch) {
      const year = Number(stdMatch[1]);
      const month = Number(stdMatch[2]) - 1;
      const day = Number(stdMatch[3]);
      const hour = Number(stdMatch[4]);
      const minute = Number(stdMatch[5]);
      const second = Number(stdMatch[6]);
      if (
        this.isValidDateValues(year, month, day) &&
        this.isValidTimeValues(hour, minute, second)
      ) {
        return new Date(year, month, day, hour, minute, second);
      }
    }

    // 3. Pola YYYY-MM-DD HH.MM.SS atau YYYY-MM-DD at HH.MM.SS
    const dateDashMatch = base.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ _T]| at )(\d{2})[.:](\d{2})[.:](\d{2})/i,
    );
    if (dateDashMatch) {
      const year = Number(dateDashMatch[1]);
      const month = Number(dateDashMatch[2]) - 1;
      const day = Number(dateDashMatch[3]);
      const hour = Number(dateDashMatch[4]);
      const minute = Number(dateDashMatch[5]);
      const second = Number(dateDashMatch[6]);
      if (
        this.isValidDateValues(year, month, day) &&
        this.isValidTimeValues(hour, minute, second)
      ) {
        return new Date(year, month, day, hour, minute, second);
      }
    }

    // 4. Pola angka padat YYYYMMDD_HHMMSS
    const compactMatch = base.match(/^(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})$/);
    if (compactMatch) {
      const year = Number(compactMatch[1]);
      const month = Number(compactMatch[2]) - 1;
      const day = Number(compactMatch[3]);
      const hour = Number(compactMatch[4]);
      const minute = Number(compactMatch[5]);
      const second = Number(compactMatch[6]);
      if (
        this.isValidDateValues(year, month, day) &&
        this.isValidTimeValues(hour, minute, second)
      ) {
        return new Date(year, month, day, hour, minute, second);
      }
    }

    return null;
  }

  private isValidDateValues(year: number, month: number, day: number): boolean {
    if (year < 1970 || year > 2100) return false;
    if (month < 0 || month > 11) return false;
    if (day < 1 || day > 31) return false;
    return true;
  }

  private isValidTimeValues(hour: number, minute: number, second: number): boolean {
    if (hour < 0 || hour > 23) return false;
    if (minute < 0 || minute > 59) return false;
    if (second < 0 || second > 59) return false;
    return true;
  }

  /**
   * Mengurai string offset zona waktu EXIF (contoh: "+07:00" atau "-05:00") menjadi menit.
   */
  parseOffsetMinutes(offsetStr: string | null | undefined): number | null {
    if (!offsetStr || typeof offsetStr !== 'string') return null;
    const match = offsetStr.trim().match(/^([+-])(\d{1,2}):?(\d{2})?$/);
    if (!match) return null;
    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = match[3] ? Number(match[3]) : 0;
    return sign * (hours * 60 + minutes);
  }

  /**
   * Memvalidasi lastModified kiriman klien (tidak boleh <= 0 dan tidak di masa depan > 1 hari).
   */
  validateClientLastModified(raw: number | null | undefined): number | null {
    if (raw === null || raw === undefined) return null;
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const maxFuture = Date.now() + 86400_000;
    if (raw > maxFuture) return null;
    return raw;
  }

  /**
   * Menukar width dan height bila orientasi foto memerlukan rotasi 90/270 derajat (EXIF 5-8).
   */
  adjustDimensionsForOrientation(
    width: number | null,
    height: number | null,
    orientation: number | null,
  ): { width: number | null; height: number | null } {
    if (!width || !height || !orientation) {
      return { width, height };
    }
    if (orientation >= 5 && orientation <= 8) {
      return { width: height, height: width };
    }
    return { width, height };
  }

  /**
   * Ekstraksi metadata menyeluruh saat upload selesai.
   * Aman: kegagalan membaca EXIF tidak menggagalkan upload (hanya mencatat log peringatan).
   */
  async extractMetadata(options: ExtractMetadataOptions): Promise<ExtractedMetadata> {
    const { filePath, originalName, mimeType, clientLastModified } = options;

    let parsedExif: Record<string, unknown> | null = null;
    let gpsData: { latitude?: number; longitude?: number } | null = null;
    let videoProbe: VideoProbeResult | null = null;

    if (mimeType.startsWith('image/')) {
      try {
        parsedExif = await exifr.parse(filePath, {
          tiff: true,
          xmp: true,
          exif: true,
          gps: true,
          translateValues: false,
          reviveValues: true,
        });
        gpsData = await exifr.gps(filePath).catch(() => null);
      } catch (err) {
        this.logger.warn(
          `Gagal membaca EXIF dari ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else if (mimeType.startsWith('video/') && this.videoProcessing) {
      videoProbe = await this.videoProcessing.extractMetadata(filePath);
    }

    // 1. Rantai tanggal:
    // EXIF DateTimeOriginal -> CreateDate -> video creation_time (RF-34) -> filename -> clientLastModified -> waktu upload
    let capturedAt: Date | null = null;
    let capturedTzOffsetMin: number | null = null;
    let capturedAtSource: ExtractedMetadata['capturedAtSource'] = 'upload';

    const dtOrig = parsedExif?.['DateTimeOriginal'];
    if (dtOrig instanceof Date && !isNaN(dtOrig.getTime())) {
      capturedAt = dtOrig;
      capturedAtSource = 'exif';
      capturedTzOffsetMin = this.parseOffsetMinutes(
        parsedExif?.['OffsetTimeOriginal'] as string,
      );
    } else {
      const dtCreate = parsedExif?.['CreateDate'] ?? parsedExif?.['ModifyDate'];
      if (dtCreate instanceof Date && !isNaN(dtCreate.getTime())) {
        capturedAt = dtCreate;
        capturedAtSource = 'exif';
        capturedTzOffsetMin = this.parseOffsetMinutes(
          (parsedExif?.['OffsetTimeDigitized'] ?? parsedExif?.['OffsetTime']) as string,
        );
      } else if (
        videoProbe?.creationTime instanceof Date &&
        !isNaN(videoProbe.creationTime.getTime())
      ) {
        capturedAt = videoProbe.creationTime;
        capturedAtSource = 'video';
      }
    }

    if (!capturedAt) {
      const fromFilename = this.parseFilenameDate(originalName);
      if (fromFilename) {
        capturedAt = fromFilename;
        capturedAtSource = 'filename';
      }
    }

    if (!capturedAt) {
      const validClientMod = this.validateClientLastModified(clientLastModified);
      if (validClientMod) {
        capturedAt = new Date(validClientMod);
        capturedAtSource = 'client_modified';
      }
    }

    if (!capturedAt) {
      capturedAt = new Date();
      capturedAtSource = 'upload';
    }

    // 2. Orientasi
    const orientation =
      typeof parsedExif?.['Orientation'] === 'number'
        ? parsedExif['Orientation']
        : null;

    // 3. Dimensi (lebar x tinggi)
    let rawWidth = options.fallbackWidth ?? videoProbe?.width ?? null;
    let rawHeight = options.fallbackHeight ?? videoProbe?.height ?? null;

    if (!rawWidth || !rawHeight) {
      const exifW = Number(
        parsedExif?.['ImageWidth'] ?? parsedExif?.['ExifImageWidth'],
      );
      const exifH = Number(
        parsedExif?.['ImageHeight'] ?? parsedExif?.['ExifImageHeight'],
      );
      if (Number.isFinite(exifW) && Number.isFinite(exifH) && exifW > 0 && exifH > 0) {
        rawWidth = exifW;
        rawHeight = exifH;
      }
    }

    if ((!rawWidth || !rawHeight) && mimeType.startsWith('image/')) {
      try {
        const sharpMeta = await sharp(filePath).metadata();
        if (sharpMeta.width && sharpMeta.height) {
          rawWidth = sharpMeta.width;
          rawHeight = sharpMeta.height;
        }
      } catch {
        // Abaikan
      }
    }

    const { width, height } = this.adjustDimensionsForOrientation(
      rawWidth,
      rawHeight,
      orientation,
    );

    // 4. GPS
    const gpsLat =
      typeof gpsData?.latitude === 'number'
        ? gpsData.latitude
        : typeof parsedExif?.['latitude'] === 'number'
          ? (parsedExif['latitude'] as number)
          : (videoProbe?.gpsLat ?? null);

    const gpsLng =
      typeof gpsData?.longitude === 'number'
        ? gpsData.longitude
        : typeof parsedExif?.['longitude'] === 'number'
          ? (parsedExif['longitude'] as number)
          : (videoProbe?.gpsLng ?? null);

    const gpsAltM =
      typeof parsedExif?.['GPSAltitude'] === 'number'
        ? (parsedExif['GPSAltitude'] as number)
        : (videoProbe?.gpsAltM ?? null);

    // 5. Kamera dan lensa
    const cameraMake =
      typeof parsedExif?.['Make'] === 'string'
        ? (parsedExif['Make'] as string).trim()
        : (videoProbe?.cameraMake ?? null);

    const cameraModel =
      typeof parsedExif?.['Model'] === 'string'
        ? (parsedExif['Model'] as string).trim()
        : (videoProbe?.cameraModel ?? null);

    const lensModel =
      typeof parsedExif?.['LensModel'] === 'string'
        ? (parsedExif['LensModel'] as string).trim()
        : null;

    // 6. Parameter eksposur
    const iso =
      typeof parsedExif?.['ISO'] === 'number'
        ? (parsedExif['ISO'] as number)
        : null;

    const fNumber =
      typeof parsedExif?.['FNumber'] === 'number'
        ? (parsedExif['FNumber'] as number)
        : null;

    const exposureS =
      typeof parsedExif?.['ExposureTime'] === 'number'
        ? (parsedExif['ExposureTime'] as number)
        : null;

    const focalLengthMm =
      typeof parsedExif?.['FocalLength'] === 'number'
        ? (parsedExif['FocalLength'] as number)
        : null;

    return {
      capturedAt,
      capturedTzOffsetMin,
      capturedAtSource,
      width,
      height,
      durationS: videoProbe?.durationS ?? null,
      orientation,
      gpsLat,
      gpsLng,
      gpsAltM,
      cameraMake,
      cameraModel,
      lensModel,
      iso,
      fNumber,
      exposureS,
      focalLengthMm,
    };
  }
}

