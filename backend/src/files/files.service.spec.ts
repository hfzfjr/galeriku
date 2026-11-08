import {
  decodeCursor,
  encodeCursor,
  FilesService,
  toFileDetail,
  toFileItem,
} from './files.service';
import type { PrismaService } from '../prisma/prisma.service';
import { parseRange } from './files.controller';

describe('FilesService helpers', () => {
  describe('cursor buram (RF-12)', () => {
    it('bolak-balik capturedAt dan id, serta menolak cursor lama atau invalid dengan 400', () => {
      const id = 'f-xyz-123';
      const capturedAt = '2026-11-01T15:30:00.000Z';
      const encoded = encodeCursor(capturedAt, id);
      expect(typeof encoded).toBe('string');
      expect(decodeCursor(encoded)).toEqual({ capturedAt, id });

      // Bolak-balik createdAt untuk sort=uploaded (RF-23)
      const createdAt = '2026-11-05T08:00:00.000Z';
      const encodedUploaded = encodeCursor(createdAt, id, 'uploaded');
      expect(decodeCursor(encodedUploaded)).toEqual({ createdAt, id });

      // Cursor keyset universal RF-40: name & asc
      const encodedName = encodeCursor('foto.jpg', id, 'name', 'asc');
      expect(decodeCursor(encodedName)).toEqual({
        sort: 'name',
        order: 'asc',
        val: 'foto.jpg',
        id,
      });

      // Cursor keyset universal RF-40: size & desc
      const encodedSize = encodeCursor(1048576n, id, 'size', 'desc');
      expect(decodeCursor(encodedSize)).toEqual({
        sort: 'size',
        order: 'desc',
        val: '1048576',
        id,
      });

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
        liveKind: 'none',
        isFavorite: false,
        takenAt: null,
        capturedAt: '2026-10-31T12:00:00.000Z',
        capturedTzOffsetMin: null,
        capturedAtSource: undefined,
        place: null,
        hasLocation: false,
        cameraMake: null,
        cameraModel: null,
        lensModel: null,
        iso: null,
        fNumber: null,
        exposureS: null,
        focalLengthMm: null,
        duplicateOfId: null,
        isDuplicate: false,
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

    it('toFileDetail menyertakan koordinat GPS dan orientasi untuk pemilik (RF-14)', () => {
      const now = new Date('2026-10-31T12:00:00.000Z');
      const detail = toFileDetail({
        id: 'file-detail',
        originalName: 'pantai.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000n,
        kind: 'image',
        width: 1920,
        height: 1080,
        durationS: null,
        thumbKey: null,
        status: 'ready',
        gpsLat: -8.4095,
        gpsLng: 115.1889,
        gpsAltM: 50.0,
        orientation: 1,
        cameraMake: 'Sony',
        cameraModel: 'A7 IV',
        createdAt: now,
      });

      expect(detail.gpsLat).toBe(-8.4095);
      expect(detail.gpsLng).toBe(115.1889);
      expect(detail.gpsAltM).toBe(50.0);
      expect(detail.orientation).toBe(1);
      expect(detail.cameraMake).toBe('Sony');
      expect(detail.cameraModel).toBe('A7 IV');
      expect(detail.hasLocation).toBe(true);
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

  describe('FilesService.listFiles (RF-40)', () => {
    let service: FilesService;
    let findManyCalls: any[];

    beforeEach(() => {
      findManyCalls = [];
      const mockPrisma: any = {
        file: {
          findMany: async (args: any) => {
            findManyCalls.push(args);
            return [];
          },
        },
      };
      service = new FilesService(mockPrisma as PrismaService);
    });

    it('menolak parameter tak dikenal dengan 400 VALIDATION_ERROR (strictness)', async () => {
      await expect(
        service.listFiles('u-1', { paramTakDikenal: 'nilai' }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('menolak cursor jika mode sort tidak cocok dengan query', async () => {
      const cursorTaken = encodeCursor(new Date(), 'f-1', 'taken', 'desc');
      await expect(
        service.listFiles('u-1', { sort: 'size', cursor: cursorTaken }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_CURSOR',
      });
    });

    it('membangun query filter lengkap (kind, favorite, live, hasLocation, unalbumed, duplicates, from, to, place, q)', async () => {
      await service.listFiles('u-1', {
        kind: 'image',
        favorite: 'true',
        live: 'true',
        hasLocation: 'true',
        unalbumed: 'true',
        duplicates: 'true',
        from: '2026-01-01',
        to: '2026-12-31',
        place: 'Bandung',
        q: 'liburan',
        sort: 'size',
        order: 'asc',
        limit: 10,
      });

      expect(findManyCalls.length).toBe(1);
      const args = findManyCalls[0];

      expect(args.where.ownerId).toBe('u-1');
      expect(args.where.kind).toBe('image');
      expect(args.where.isFavorite).toBe(true);
      expect(args.where.liveKind).toEqual({ not: 'none' });
      expect(args.where.gpsLat).toEqual({ not: null });
      expect(args.where.albumFiles).toEqual({ none: {} });
      expect(args.where.duplicateOfId).toEqual({ not: null });
      expect(args.where.capturedAt).toBeDefined();
      expect(args.orderBy).toEqual([{ sizeBytes: 'asc' }, { id: 'asc' }]);
      expect(args.take).toBe(11);
    });

    it('mendukung loncat waktu anchor YYYY-MM (RF-41)', async () => {
      await service.listFiles('u-1', {
        anchor: '2026-05',
        order: 'desc',
      });

      expect(findManyCalls.length).toBe(1);
      const args = findManyCalls[0];
      expect(args.where.AND).toEqual([
        { capturedAt: { lt: new Date(Date.UTC(2026, 5, 1, 0, 0, 0, 0)) } },
      ]);
    });

    it('getTimeline mengelompokkan bucket tahun & bulan serta menolak query tak dikenal (RF-41)', async () => {
      const mockRows = [
        { capturedAt: new Date('2026-05-10T10:00:00Z') },
        { capturedAt: new Date('2026-05-15T12:00:00Z') },
        { capturedAt: new Date('2026-04-01T08:00:00Z') },
      ];
      const customPrisma: any = {
        file: {
          findMany: async () => mockRows,
        },
      };
      const customService = new FilesService(customPrisma as PrismaService);

      const timeline = await customService.getTimeline('u-1', { kind: 'image' });
      expect(timeline.buckets).toEqual([
        { year: 2026, month: 5, count: 2 },
        { year: 2026, month: 4, count: 1 },
      ]);

      // Menolak parameter asing di timeline
      await expect(
        customService.getTimeline('u-1', { limit: 10 }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });
  });
});

