import {
  decodeCursor,
  encodeCursor,
  toFileItem,
} from './files.service';

describe('FilesService helpers', () => {
  describe('cursor buram', () => {
    it('bolak-balik id dan menolak format invalid', () => {
      const id = 'f-xyz-123';
      const encoded = encodeCursor(id);
      expect(typeof encoded).toBe('string');
      expect(decodeCursor(encoded)).toBe(id);

      expect(decodeCursor('bukan-base64!!!')).toBeNull();
      expect(decodeCursor('')).toBeNull();
      expect(
        decodeCursor(
          Buffer.from(JSON.stringify({ salah: 'struktur' })).toString('base64url'),
        ),
      ).toBeNull();
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
        status: 'ready',
        takenAt: null,
        createdAt: '2026-10-31T12:00:00.000Z',
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
    });
  });
});

