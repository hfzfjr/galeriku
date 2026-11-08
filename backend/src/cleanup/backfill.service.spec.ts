import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jest } from '@jest/globals';
import { BackfillService } from './backfill.service';
import { FileKind, FileStatus } from '../generated/prisma/client';

describe('BackfillService (RF-15)', () => {
  let tempDir: string;
  const originalMediaDir = process.env.MEDIA_DIR;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'galeriku-backfill-test-'));
    process.env.MEDIA_DIR = tempDir;
  });

  afterEach(() => {
    process.env.MEDIA_DIR = originalMediaDir;
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('hanya memproses file dengan metaVersion < 1 (idempoten)', async () => {
    const updatedFiles: Array<{ id: string; metaVersion: number }> = [];

    const mockPrisma = {
      file: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'f-v0',
            originalName: 'lama.jpg',
            storageKey: 'lama.jpg',
            mimeType: 'image/jpeg',
            kind: FileKind.image,
            status: FileStatus.ready,
            metaVersion: 0,
            width: null,
            height: null,
            thumbKey: null,
            previewKey: null,
          },
        ]),
        update: jest.fn().mockImplementation(({ where, data }) => {
          updatedFiles.push({ id: where.id, metaVersion: data.metaVersion });
          return Promise.resolve({ id: where.id, ...data });
        }),
      },
    };

    // Buat file fisik di tempDir
    writeFileSync(join(tempDir, 'lama.jpg'), 'fake-image-bytes');

    const mockMetadata = {
      extractMetadata: jest.fn().mockResolvedValue({
        capturedAt: new Date('2025-05-01T10:00:00.000Z'),
        capturedTzOffsetMin: 420,
        capturedAtSource: 'exif',
        width: 1920,
        height: 1080,
        orientation: 1,
        cameraMake: 'Canon',
        cameraModel: 'EOS R5',
        lensModel: 'RF 24-70mm',
        iso: 100,
        fNumber: 2.8,
        exposureS: 0.004,
        focalLengthMm: 50,
        gpsLat: null,
        gpsLng: null,
        gpsAltM: null,
      }),
    };

    const mockThumbnail = {
      generatePhotoVariants: jest.fn().mockResolvedValue({
        thumbKey: 'lama.thumb.webp',
        previewKey: 'lama.prev.webp',
        width: 1920,
        height: 1080,
      }),
    };

    const mockPlace = {
      resolve: jest.fn().mockReturnValue(null),
    };

    const service = new BackfillService(
      mockPrisma as any,
      mockMetadata as any,
      mockThumbnail as any,
      mockPlace as any,
    );

    const result = await service.runOnce({ delayMs: 1 });

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
    expect(mockMetadata.extractMetadata).toHaveBeenCalledTimes(1);
    expect(mockThumbnail.generatePhotoVariants).toHaveBeenCalledTimes(1);
    expect(updatedFiles).toEqual([{ id: 'f-v0', metaVersion: 1 }]);
  });

  it('melewati file fisik yang hilang dengan peringatan tanpa crash', async () => {
    const mockPrisma = {
      file: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'f-missing',
            originalName: 'hilang.jpg',
            storageKey: 'hilang.jpg',
            mimeType: 'image/jpeg',
            kind: FileKind.image,
            status: FileStatus.ready,
            metaVersion: 0,
          },
        ]),
        update: jest.fn(),
      },
    };

    const mockMetadata = {
      extractMetadata: jest.fn(),
    };
    const mockThumbnail = {
      generatePhotoVariants: jest.fn(),
    };

    const mockPlace = {
      resolve: jest.fn().mockReturnValue(null),
    };

    const service = new BackfillService(
      mockPrisma as any,
      mockMetadata as any,
      mockThumbnail as any,
      mockPlace as any,
    );

    const result = await service.runOnce({ delayMs: 1 });

    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toBe(0);
    expect(mockMetadata.extractMetadata).not.toHaveBeenCalled();
    expect(mockPrisma.file.update).not.toHaveBeenCalled();
  });
});
