import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { resolveMediaDir } from './uploads.utils';
import { ConcurrencyLimiter } from './thumbnail.service';

const execFileAsync = promisify(execFile);

export interface VideoProbeResult {
  durationS: number | null;
  width: number | null;
  height: number | null;
  creationTime: Date | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAltM: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  contentIdentifier: string | null;
}

/**
 * Mengurai koordinat ISO 6709 (misal: "+07.1234-110.5678/" atau "-06.2088+106.8456+012.300/")
 */
export function parseIso6709(raw?: string | null): {
  lat: number;
  lng: number;
  altM: number | null;
} | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const match = trimmed.match(
    /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)(?:([+-]\d+(?:\.\d+)?))?\/?$/,
  );
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  const alt = match[3] ? Number(match[3]) : null;

  if (
    isNaN(lat) ||
    isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return {
    lat,
    lng,
    altM: alt !== null && !isNaN(alt) ? alt : null,
  };
}

/**
 * Mengurai string tanggal pembuatan video dari berbagai tag container (QuickTime/MP4/MKV/WebM)
 * secara aman dan konsisten tanpa pergeseran ganda zona waktu.
 */
export function parseVideoCreationDate(raw?: string | null): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(\d{4})[-/:](\d{2})[-/:](\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?/,
  );
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const hour = match[4] ? Number(match[4]) : 0;
    const minute = match[5] ? Number(match[5]) : 0;
    const second = match[6] ? Number(match[6]) : 0;

    // Abaikan tahun < 1971 (zero epoch QuickTime 1904 atau Unix 1970)
    if (year < 1971 || year > 2100) return null;

    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime()) && d.getUTCFullYear() >= 1971 && d.getUTCFullYear() <= 2100) {
    return new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds(),
      ),
    );
  }
  return null;
}

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);
  readonly limiter = new ConcurrencyLimiter(1); // Konkurensi proses video = 1 (RF-34)

  constructor(private readonly prisma?: PrismaService) {}

  /**
   * Ekstraksi metadata video via ffprobe (RF-34 Bagian A).
   * Mengambil durasi, resolusi (menghormati rotasi), creation_time, GPS ISO6709, dan kamera.
   */
  async extractMetadata(
    filePath: string,
    runner: typeof execFileAsync = execFileAsync,
  ): Promise<VideoProbeResult> {
    try {
      const { stdout } = await runner(
        'ffprobe',
        [
          '-v',
          'error',
          '-print_format',
          'json',
          '-show_format',
          '-show_streams',
          filePath,
        ],
        { timeout: 15000 },
      );

      const parsed = JSON.parse(stdout) as {
        streams?: Array<{
          codec_type?: string;
          width?: number;
          height?: number;
          duration?: string;
          tags?: Record<string, string>;
          side_data_list?: Array<{ rotation?: number }>;
        }>;
        format?: {
          duration?: string;
          tags?: Record<string, string>;
        };
      };

      const videoStream = parsed.streams?.find(
        (s) => s.codec_type === 'video',
      );

      // 1. Dimensi dan rotasi
      let width = videoStream?.width ? Number(videoStream.width) : null;
      let height = videoStream?.height ? Number(videoStream.height) : null;

      const rotTag = videoStream?.tags?.['rotate'];
      const sideDataRot = videoStream?.side_data_list?.find(
        (sd) => typeof sd.rotation === 'number',
      )?.rotation;

      const rotation = sideDataRot !== undefined ? sideDataRot : rotTag ? Number(rotTag) : 0;
      if (Math.abs(rotation) === 90 || Math.abs(rotation) === 270) {
        if (width && height) {
          const temp = width;
          width = height;
          height = temp;
        }
      }

      // 2. Durasi (detik)
      const rawDuration =
        parsed.format?.duration || videoStream?.duration;
      let durationS: number | null = null;
      if (rawDuration) {
        const parsedDur = parseFloat(rawDuration);
        if (Number.isFinite(parsedDur) && parsedDur > 0) {
          durationS = Math.round(parsedDur * 100) / 100;
        }
      }

      // 3. Tanggal pembuatan (QuickTime creationdate, standard creation_time, date, media_create_date)
      const creationRaw =
        parsed.format?.tags?.['com.apple.quicktime.creationdate'] ||
        videoStream?.tags?.['com.apple.quicktime.creationdate'] ||
        parsed.format?.tags?.['creation_time'] ||
        videoStream?.tags?.['creation_time'] ||
        parsed.format?.tags?.['date'] ||
        videoStream?.tags?.['date'] ||
        parsed.format?.tags?.['date-eng'] ||
        videoStream?.tags?.['date-eng'] ||
        parsed.format?.tags?.['media_create_date'] ||
        videoStream?.tags?.['media_create_date'];
      const creationTime = parseVideoCreationDate(creationRaw);

      // 4. GPS (ISO 6709 - Apple QuickTime & standard)
      const locRaw =
        parsed.format?.tags?.['com.apple.quicktime.location.ISO6709'] ||
        videoStream?.tags?.['com.apple.quicktime.location.ISO6709'] ||
        parsed.format?.tags?.['location'] ||
        parsed.format?.tags?.['location-eng'] ||
        videoStream?.tags?.['location'];
      const parsedGps = parseIso6709(locRaw);

      // 5. Kamera
      const cameraMake =
        parsed.format?.tags?.['com.apple.quicktime.make'] ||
        videoStream?.tags?.['com.apple.quicktime.make'] ||
        parsed.format?.tags?.['make'] ||
        videoStream?.tags?.['make'] ||
        null;
      const cameraModel =
        parsed.format?.tags?.['com.apple.quicktime.model'] ||
        videoStream?.tags?.['com.apple.quicktime.model'] ||
        parsed.format?.tags?.['model'] ||
        videoStream?.tags?.['model'] ||
        parsed.format?.tags?.['com.apple.quicktime.software'] ||
        null;

      // 6. Apple ContentIdentifier untuk Live Photo MOV (RF-32)
      const contentIdRaw =
        parsed.format?.tags?.['com.apple.quicktime.content.identifier'] ||
        videoStream?.tags?.['com.apple.quicktime.content.identifier'] ||
        parsed.format?.tags?.['com.apple.quicktime.content-identifier'] ||
        videoStream?.tags?.['com.apple.quicktime.content-identifier'];
      const contentIdentifier = contentIdRaw ? contentIdRaw.trim().toUpperCase() : null;

      return {
        durationS,
        width,
        height,
        creationTime,
        gpsLat: parsedGps?.lat ?? null,
        gpsLng: parsedGps?.lng ?? null,
        gpsAltM: parsedGps?.altM ?? null,
        cameraMake: cameraMake ? cameraMake.trim() : null,
        cameraModel: cameraModel ? cameraModel.trim() : null,
        contentIdentifier,
      };
    } catch (err) {
      this.logger.warn(
        `ffprobe gagal mengekstrak metadata untuk ${filePath}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {
        durationS: null,
        width: null,
        height: null,
        creationTime: null,
        gpsLat: null,
        gpsLng: null,
        gpsAltM: null,
        cameraMake: null,
        cameraModel: null,
        contentIdentifier: null,
      };
    }
  }

  /**
   * Menghasilkan poster WebP 400px dari satu frame video (RF-34 Bagian A).
   * Frame diambil di ~10% durasi atau detik ke-1.
   */
  async generatePoster(
    filePath: string,
    posterPath: string,
    durationS?: number | null,
    runner: typeof execFileAsync = execFileAsync,
    fileChecker: (path: string) => boolean = existsSync,
  ): Promise<boolean> {
    return this.limiter.run(async () => {
      try {
        let seekTime = 0;
        if (durationS && durationS > 1) {
          seekTime = Math.min(Math.max(1, durationS * 0.1), durationS - 0.1);
        }

        const args = [
          '-ss',
          seekTime.toFixed(2),
          '-i',
          filePath,
          '-vframes',
          '1',
          '-vf',
          'scale=400:400:force_original_aspect_ratio=decrease',
          '-c:v',
          'libwebp',
          '-quality',
          '80',
          '-y',
          posterPath,
        ];

        await runner('ffmpeg', args, { timeout: 30000 });
        return fileChecker(posterPath);
      } catch (err) {
        this.logger.warn(
          `ffmpeg gagal membuat poster untuk ${filePath}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return false;
      }
    });
  }

  /**
   * Menjadwalkan pembuatan poster video di background antrian konkurensi 1 (RF-34).
   * Tidak menahan respons upload. Setelah siap, database diperbarui secara asinkron.
   */
  enqueuePosterGeneration(
    fileId: string,
    storageKey: string,
    filePath: string,
    durationS?: number | null,
  ): void {
    const mediaDir = resolveMediaDir();
    const thumbFilename = `${storageKey}.thumb.webp`;
    const posterPath = join(mediaDir, thumbFilename);

    void (async () => {
      try {
        const ok = await this.generatePoster(filePath, posterPath, durationS);
        if (ok && this.prisma) {
          await this.prisma.file.update({
            where: { id: fileId },
            data: { thumbKey: thumbFilename },
          });
          this.logger.debug(
            `Poster video berhasil dibuat dan dicatat untuk id=${fileId} thumbKey=${thumbFilename}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Antrian poster video gagal memproses id=${fileId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    })();
  }

  /**
   * Membuat atau mengambil varian video tanpa metadata lokasi (RF-34 Bagian B).
   * Disimpan sebagai cache <storageKey>.nogps.<ext> dengan map_metadata -1 -c copy.
   */
  async getOrCreateNoGpsVideo(
    storageKey: string,
    originalPath: string,
    runner: typeof execFileAsync = execFileAsync,
  ): Promise<string> {
    const mediaDir = resolveMediaDir();
    const ext = extname(originalPath) || '.mp4';
    const noGpsFilename = `${storageKey}.nogps${ext}`;
    const noGpsPath = join(mediaDir, noGpsFilename);

    if (existsSync(noGpsPath)) {
      return noGpsPath;
    }

    try {
      await runner(
        'ffmpeg',
        ['-i', originalPath, '-map_metadata', '-1', '-c', 'copy', '-y', noGpsPath],
        { timeout: 60000 },
      );
      if (existsSync(noGpsPath)) {
        return noGpsPath;
      }
    } catch (err) {
      this.logger.warn(
        `Gagal membuat varian video tanpa lokasi untuk ${storageKey}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return originalPath;
  }
}
