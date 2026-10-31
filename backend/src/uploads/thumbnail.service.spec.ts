import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileTypeFromFile } from 'file-type';
import sharp from 'sharp';
import {
  ConcurrencyLimiter,
  ThumbnailService,
} from './thumbnail.service';

describe('ConcurrencyLimiter (US-19)', () => {
  it('membatasi eksekusi paralel maksimal sesuai limit (2)', async () => {
    const limiter = new ConcurrencyLimiter(2);
    let maxRunning = 0;
    let currentlyRunning = 0;

    const task = async () => {
      currentlyRunning += 1;
      maxRunning = Math.max(maxRunning, currentlyRunning);
      await new Promise((resolve) => setTimeout(resolve, 50));
      currentlyRunning -= 1;
    };

    await Promise.all([
      limiter.run(task),
      limiter.run(task),
      limiter.run(task),
      limiter.run(task),
      limiter.run(task),
    ]);

    expect(maxRunning).toBe(2);
    expect(limiter.getActiveCount()).toBe(0);
    expect(limiter.getQueueLength()).toBe(0);
  });
});

describe('ThumbnailService (US-19)', () => {
  let service: ThumbnailService;
  let tempDir: string;

  beforeAll(() => {
    sharp.cache(false);
  });

  beforeEach(async () => {
    service = new ThumbnailService();
    tempDir = await mkdtemp(join(tmpdir(), 'galeriku-thumb-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('membuat thumbnail WebP <= 400px dari foto asli', async () => {
    const inputPath = join(tempDir, 'original.png');
    const outputPath = join(tempDir, 'thumb.webp');

    // Buat gambar PNG uji berukuran 800x600
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 100, b: 50 },
      },
    })
      .png()
      .toFile(inputPath);

    const res = await service.generatePhotoThumbnail(inputPath, outputPath);
    expect(res).not.toBeNull();
    expect(res?.thumbKey).toBe('thumb.webp');
    expect(res?.width).toBe(800);
    expect(res?.height).toBe(600);

    // Verifikasi file thumbnail hasil keluaran
    const detected = await fileTypeFromFile(outputPath);
    expect(detected?.mime).toBe('image/webp');

    // Verifikasi dimensi thumbnail: tidak boleh melebihi 400px
    const thumbMeta = await sharp(outputPath).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(400);
    expect(thumbMeta.height).toBeLessThanOrEqual(400);
    expect(thumbMeta.format).toBe('webp');
  });

  it('menghormati orientasi EXIF (auto rotate)', async () => {
    const inputPath = join(tempDir, 'rotated.jpg');
    const outputPath = join(tempDir, 'rotated-thumb.webp');

    // Buat gambar JPEG dengan EXIF orientation 6 (90 derajat CW)
    await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 3,
        background: { r: 50, g: 150, b: 250 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(inputPath);

    const res = await service.generatePhotoThumbnail(inputPath, outputPath);
    expect(res).not.toBeNull();

    // Karena diputar 90 derajat, dimensi lebar dan tinggi tertukar
    const thumbMeta = await sharp(outputPath).metadata();
    expect(thumbMeta.format).toBe('webp');
    expect(thumbMeta.width).toBeLessThanOrEqual(400);
    expect(thumbMeta.height).toBeLessThanOrEqual(400);
  });

  it('mengembalikan null jika berkas sumber rusak', async () => {
    const corruptPath = join(tempDir, 'corrupt.jpg');
    const outputPath = join(tempDir, 'corrupt-thumb.webp');
    await writeFile(corruptPath, 'bukan file gambar valid');

    const res = await service.generatePhotoThumbnail(corruptPath, outputPath);
    expect(res).toBeNull();
  });
});

