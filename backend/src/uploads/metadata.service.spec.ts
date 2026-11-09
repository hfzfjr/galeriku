import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MetadataService } from './metadata.service';

describe('MetadataService (RF-10)', () => {
  let service: MetadataService;
  let testDir: string;

  beforeAll(() => {
    service = new MetadataService();
    testDir = join(tmpdir(), `galeriku-meta-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Abaikan
    }
  });

  describe('Rantai fallback tanggal (parseCapturedAt)', () => {
    it('pola filename IMG_YYYYMMDD_HHMMSS', () => {
      const res = service.parseFilenameDate('IMG_20261108_143022.jpg');
      expect(res).not.toBeNull();
      expect(res?.getUTCFullYear()).toBe(2026);
      expect(res?.getUTCMonth()).toBe(10); // 0-indexed: 10 = Nov
      expect(res?.getUTCDate()).toBe(8);
      expect(res?.getUTCHours()).toBe(14);
      expect(res?.getUTCMinutes()).toBe(30);
      expect(res?.getUTCSeconds()).toBe(22);
    });

    it('pola filename WhatsApp IMG-YYYYMMDD-WA####', () => {
      const res = service.parseFilenameDate('IMG-20261108-WA0042.jpeg');
      expect(res).not.toBeNull();
      expect(res?.getUTCFullYear()).toBe(2026);
      expect(res?.getUTCMonth()).toBe(10);
      expect(res?.getUTCDate()).toBe(8);
    });

    it('pola filename YYYY-MM-DD HH.MM.SS', () => {
      const res = service.parseFilenameDate('2026-11-08 09.15.00.png');
      expect(res).not.toBeNull();
      expect(res?.getUTCFullYear()).toBe(2026);
      expect(res?.getUTCMonth()).toBe(10);
      expect(res?.getUTCDate()).toBe(8);
      expect(res?.getUTCHours()).toBe(9);
      expect(res?.getUTCMinutes()).toBe(15);
    });

    it('mengembalikan null untuk nama file acak tanpa pola tanggal', () => {
      expect(service.parseFilenameDate('foto_keluarga.jpg')).toBeNull();
      expect(service.parseFilenameDate('abc-123.mp4')).toBeNull();
      expect(service.parseFilenameDate('IMG_99999999_999999.jpg')).toBeNull();
    });

    it('memvalidasi clientLastModified tidak boleh di masa depan > 1 hari', () => {
      const now = Date.now();
      expect(service.validateClientLastModified(now - 3600_000)).toBe(now - 3600_000);
      expect(service.validateClientLastModified(now + 3600_000)).toBe(now + 3600_000);
      // 2 hari di masa depan -> null
      expect(service.validateClientLastModified(now + 2 * 86400_000)).toBeNull();
      // nilai negatif atau bukan angka -> null
      expect(service.validateClientLastModified(-100)).toBeNull();
      expect(service.validateClientLastModified(NaN)).toBeNull();
      expect(service.validateClientLastModified(null)).toBeNull();
    });

    it('fallback rantai: filename jika tanpa EXIF', async () => {
      // File teks atau dummy binary tanpa header EXIF
      const dummyPath = join(testDir, 'dummy.jpg');
      writeFileSync(dummyPath, Buffer.from('Bukan EXIF'));

      const meta = await service.extractMetadata({
        filePath: dummyPath,
        originalName: 'IMG_20261108_143022.jpg',
        mimeType: 'image/jpeg',
      });

      expect(meta.capturedAtSource).toBe('filename');
      expect(meta.capturedAt.getUTCFullYear()).toBe(2026);
      expect(meta.capturedTzOffsetMin).toBeNull();
    });

    it('fallback rantai: client_modified jika tanpa EXIF dan tanpa nama berpola', async () => {
      const dummyPath = join(testDir, 'dummy2.jpg');
      writeFileSync(dummyPath, Buffer.from('Bukan EXIF'));

      const modTime = new Date('2025-06-15T10:00:00Z').getTime();
      const meta = await service.extractMetadata({
        filePath: dummyPath,
        originalName: 'pemandangan.jpg',
        mimeType: 'image/jpeg',
        clientLastModified: modTime,
      });

      expect(meta.capturedAtSource).toBe('client_modified');
      expect(meta.capturedAt.getTime()).toBe(modTime);
    });

    it('fallback rantai: upload jika semua opsi sebelumnya tidak ada', async () => {
      const dummyPath = join(testDir, 'dummy3.jpg');
      writeFileSync(dummyPath, Buffer.from('Bukan EXIF'));

      const before = Date.now();
      const meta = await service.extractMetadata({
        filePath: dummyPath,
        originalName: 'foto.jpg',
        mimeType: 'image/jpeg',
      });

      expect(meta.capturedAtSource).toBe('upload');
      expect(meta.capturedAt.getTime()).toBeGreaterThanOrEqual(before - 50);
    });
  });

  describe('Dimensi dan orientasi', () => {
    it('menukar width dan height bila orientasi 5, 6, 7, atau 8', () => {
      const normal = service.adjustDimensionsForOrientation(800, 600, 1);
      expect(normal).toEqual({ width: 800, height: 600 });

      const rotated6 = service.adjustDimensionsForOrientation(800, 600, 6);
      expect(rotated6).toEqual({ width: 600, height: 800 });

      const rotated8 = service.adjustDimensionsForOrientation(1920, 1080, 8);
      expect(rotated8).toEqual({ width: 1080, height: 1920 });
    });

    it('mengekstrak metadata kamera dan tanggal dari file JPEG sintetis ber-EXIF', async () => {
      const sharp = (await import('sharp')).default;
      const syntheticPath = join(testDir, 'synthetic-exif.jpg');
      await sharp({
        create: {
          width: 100,
          height: 200,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .withExif({
          IFD0: {
            Make: 'Canon',
            Model: 'EOS R5',
            DateTime: '2026:11:08 14:30:22',
          },
        })
        .jpeg()
        .toFile(syntheticPath);

      const meta = await service.extractMetadata({
        filePath: syntheticPath,
        originalName: 'foto-liburan.jpg',
        mimeType: 'image/jpeg',
      });

      expect(meta.cameraMake).toBe('Canon');
      expect(meta.cameraModel).toBe('EOS R5');
      expect(meta.capturedAtSource).toBe('exif');
      expect(meta.width).toBe(100);
      expect(meta.height).toBe(200);
    });
  });
});
