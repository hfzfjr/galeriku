import {
  decodeCursor,
  encodeCursor,
  toFileItem,
} from './files.service';
import { parseRange } from './files.controller';

describe('FilesService helpers', () => {
  describe('cursor buram (RF-12)', () => {
    it('bolak-balik capturedAt dan id, serta menolak cursor lama atau invalid dengan 400', () => {
      const id = 'f-xyz-123';
      const capturedAt = '2026-11-01T15:30:00.000Z';
      const encoded = encodeCursor(capturedAt, id);
      expect(typeof encoded).toBe('string');
      expect(decodeCursor(encoded)).toEqual({ capturedAt, id });

      // Cursor format lama (hanya id) wajib ditolak dengan 400 INVALID_CURSOR
      const legacyCursor = Buffer.from(JSON.stringify({ id })).toString('base64url');
      expect(() => decodeCursor(legacyCursor)).toThrow();

      expect(() => decodeCursor('bukan-base64!!!')).toThrow();
      expect(() => decodeCursor('')).toThrow();
      expect(() =>
        decodeCursor(
          Buffer.from(JSON.stringify({ salah: 'struktur' })).toString('base64url'),
        ),
      ).toThrow();
    });
  });

  describe('toFileItem', () => {
    it('mengubah BigInt sizeBytes menjadi string dan memformat tanggal ke ISO', () => {
      const now = new Date('2026-10-31T12:00:00.000Z');
      const item = toFileItem({
        id: 'file-1',
        originalName: 'liburan.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 15482901n,
        kind: 'image',
        width: 1920,
        height: 1080,
        durationS: null,
        thumbKey: 'file-1.thumb.webp',
        previewKey: null,
        status: 'ready',
        takenAt: null,
        createdAt: now,
      });

      expect(item).toEqual({
        id: 'file-1',
        originalName: 'liburan.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: '15482901',
        kind: 'image',
        width: 1920,
        height: 1080,
        durationS: null,
        thumbKey: 'file-1.thumb.webp',
        previewKey: null,
        status: 'ready',
        isFavorite: false,
        takenAt: null,
        capturedAt: '2026-10-31T12:00:00.000Z',
        capturedTzOffsetMin: null,
        capturedAtSource: undefined,
        place: null,
        hasLocation: false,
        createdAt: '2026-10-31T12:00:00.000Z',
        deletedAt: null,
      });
    });

    it('mendukung jenis video', () => {
      const now = new Date('2026-10-31T12:00:00.000Z');
      const item = toFileItem({
        id: 'file-2',
        originalName: 'video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 104857600n,
        kind: 'video',
        width: 1920,
        height: 1080,
        durationS: 42.5,
        thumbKey: null,
        status: 'ready',
        takenAt: now,
        createdAt: now,
      });

      expect(item.kind).toBe('video');
      expect(item.sizeBytes).toBe('104857600');
      expect(item.durationS).toBe(42.5);
      expect(item.thumbKey).toBeNull();
      expect(item.previewKey).toBeNull();
    });

    it('mendukung capturedAt dengan zona offset (RF-12)', () => {
      const captured = new Date('2026-11-01T15:00:00.000Z');
      const item = toFileItem({
        id: 'file-tz',
        originalName: 'foto-wib.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000n,
        kind: 'image',
        width: 800,
        height: 600,
        durationS: null,
        thumbKey: null,
        previewKey: null,
        status: 'ready',
        capturedAt: captured,
        capturedTzOffsetMin: 420, // WIB (+07:00)
        capturedAtSource: 'manual',
        createdAt: captured,
      });

      expect(item.capturedAt).toBe('2026-11-01T15:00:00.000Z');
      expect(item.capturedTzOffsetMin).toBe(420);
      expect(item.capturedAtSource).toBe('manual');
    });
  });

  describe('parseRange helper', () => {
    it('mem-parsing range lengkap bytes=0-499', () => {
      const res = parseRange('bytes=0-499', 1000);
      expect(res).toEqual({ start: 0, end: 499 });
    });

    it('mem-parsing range terbuka bytes=500-', () => {
      const res = parseRange('bytes=500-', 1000);
      expect(res).toEqual({ start: 500, end: 999 });
    });

    it('mem-parsing suffix bytes=-200 (200 byte terakhir)', () => {
      const res = parseRange('bytes=-200', 1000);
      expect(res).toEqual({ start: 800, end: 999 });
    });

    it('menolak format tidak valid atau range melebihi ukuran total', () => {
      expect(parseRange('invalid', 1000)).toBeNull();
      expect(parseRange('bytes=1500-2000', 1000)).toBeNull();
      expect(parseRange('bytes=500-400', 1000)).toBeNull();
    });
  });
});

