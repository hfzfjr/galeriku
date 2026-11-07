import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UserStatus } from '../generated/prisma/client';
import {
  checkDiskGuard,
  checkUserQuotaAndStatus,
  FALLBACK_ORIGINAL_NAME,
  getFileExtension,
  inferKind,
  isSvg,
  resolveMediaDir,
  sanitizeOriginalName,
  sniffAndValidateFile,
  tusDirOf,
  validateUploadMetadata,
} from './uploads.utils';

describe('sanitizeOriginalName (US-17)', () => {
  it('nama biasa lolos apa adanya', () => {
    expect(sanitizeOriginalName('foto liburan.jpg')).toBe('foto liburan.jpg');
  });

  it('membuang komponen path (traversal dan fakepath)', () => {
    expect(sanitizeOriginalName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeOriginalName('..\\..\\windows\\x.png')).toBe('x.png');
    expect(sanitizeOriginalName('C:\\fakepath\\foto.jpg')).toBe('foto.jpg');
    expect(sanitizeOriginalName('/a/b/c.mp4')).toBe('c.mp4');
  });

  it('membuang karakter kontrol dan spasi tepi', () => {
    expect(sanitizeOriginalName('a\x00b\x1Fc\x7F.jpg  ')).toBe('abc.jpg');
  });

  it('kosong/bukan string menjadi nama pengganti', () => {
    expect(sanitizeOriginalName('')).toBe(FALLBACK_ORIGINAL_NAME);
    expect(sanitizeOriginalName('   ')).toBe(FALLBACK_ORIGINAL_NAME);
    expect(sanitizeOriginalName('.../...')).toBe('...');
    expect(sanitizeOriginalName(undefined)).toBe(FALLBACK_ORIGINAL_NAME);
    expect(sanitizeOriginalName(null)).toBe(FALLBACK_ORIGINAL_NAME);
    expect(sanitizeOriginalName(42)).toBe(FALLBACK_ORIGINAL_NAME);
  });

  it('dibatasi 255 karakter', () => {
    const panjang = `a`.repeat(300);
    expect(sanitizeOriginalName(panjang)).toHaveLength(255);
  });
});

describe('getFileExtension & inferKind (US-18)', () => {
  it('ekstrak ekstensi dengan benar', () => {
    expect(getFileExtension('foto.jpg')).toBe('jpg');
    expect(getFileExtension('VIDEO.MP4')).toBe('mp4');
    expect(getFileExtension('arsip.tar.gz')).toBe('gz');
    expect(getFileExtension('tanpa-ekstensi')).toBe('');
  });

  it('deteksi SVG', () => {
    expect(isSvg('ikon.svg')).toBe(true);
    expect(isSvg('foto.jpg', 'image/svg+xml')).toBe(true);
    expect(isSvg('foto.jpg', 'image/jpeg')).toBe(false);
  });

  it('inferKind mengidentifikasi video dan image', () => {
    expect(inferKind('video/mp4', 'klip.mp4')).toBe('video');
    expect(inferKind('video/quicktime', 'klip.mov')).toBe('video');
    expect(inferKind('video/webm', 'klip.webm')).toBe('video');
    expect(inferKind('application/octet-stream', 'klip.mp4')).toBe('video');
    expect(inferKind('image/jpeg', 'foto.jpg')).toBe('image');
    expect(inferKind('image/png', 'foto.png')).toBe('image');
    expect(inferKind('image/heic', 'foto.heic')).toBe('image');
  });
});

describe('validateUploadMetadata (US-18)', () => {
  const MAX_IMAGE = 26214400n; // 25 MB
  const MAX_VIDEO = 2147483648n; // 2 GB

  it('lolos untuk foto dan video valid', () => {
    const foto = validateUploadMetadata(
      { filename: 'foto.jpg', filetype: 'image/jpeg' },
      1000000n,
      MAX_IMAGE,
      MAX_VIDEO,
    );
    expect(foto.kind).toBe('image');
    expect(foto.originalName).toBe('foto.jpg');

    const video = validateUploadMetadata(
      { filename: 'klip.mp4', filetype: 'video/mp4' },
      50000000n,
      MAX_IMAGE,
      MAX_VIDEO,
    );
    expect(video.kind).toBe('video');
  });

  it('menolak SVG keras (PRD §11 & §12.4)', () => {
    expect(() =>
      validateUploadMetadata(
        { filename: 'ikon.svg', filetype: 'image/svg+xml' },
        100n,
        MAX_IMAGE,
        MAX_VIDEO,
      ),
    ).toThrow(
      expect.objectContaining({
        status_code: 415,
        body: expect.stringContaining('Format SVG tidak diizinkan'),
      }),
    );
  });

  it('menolak ekstensi di luar whitelist atau berbahaya', () => {
    expect(() =>
      validateUploadMetadata(
        { filename: 'program.exe' },
        100n,
        MAX_IMAGE,
        MAX_VIDEO,
      ),
    ).toThrow(
      expect.objectContaining({
        status_code: 415,
      }),
    );

    expect(() =>
      validateUploadMetadata(
        { filename: 'dokumen.pdf', filetype: 'application/pdf' },
        100n,
        MAX_IMAGE,
        MAX_VIDEO,
      ),
    ).toThrow(
      expect.objectContaining({
        status_code: 415,
      }),
    );
  });

  it('menolak foto > 25 MB dan video > 2 GB', () => {
    expect(() =>
      validateUploadMetadata(
        { filename: 'foto_besar.jpg', filetype: 'image/jpeg' },
        MAX_IMAGE + 1n,
        MAX_IMAGE,
        MAX_VIDEO,
      ),
    ).toThrow(
      expect.objectContaining({
        status_code: 413,
        body: expect.stringContaining('Ukuran foto melebihi batas 25 MB'),
      }),
    );

    expect(() =>
      validateUploadMetadata(
        { filename: 'film_raksasa.mp4', filetype: 'video/mp4' },
        MAX_VIDEO + 1n,
        MAX_IMAGE,
        MAX_VIDEO,
      ),
    ).toThrow(
      expect.objectContaining({
        status_code: 413,
        body: expect.stringContaining('Ukuran video melebihi batas 2 GB'),
      }),
    );
  });
});

describe('checkDiskGuard (US-18)', () => {
  it('lolos bila ruang disk cukup', () => {
    // Pada direktori lokal normal, sisa disk > 0
    expect(() =>
      checkDiskGuard(process.cwd(), 1000n, 1000n),
    ).not.toThrow();
  });

  it('menolak bila sisa disk kurang dari ambang batas (507)', () => {
    // Meminta ambang batas raksasa yang pasti melebihi kapasitas disk
    expect(() =>
      checkDiskGuard(process.cwd(), 1000n, 999999999999999n),
    ).toThrow(
      expect.objectContaining({
        status_code: 507,
        body: expect.stringContaining('INSUFFICIENT_STORAGE'),
      }),
    );
  });
});

describe('checkUserQuotaAndStatus (US-18)', () => {
  it('menolak akun SUSPENDED dengan 403', async () => {
    const mockPrisma = {
      user: {
        findUnique: async () => ({
          status: UserStatus.SUSPENDED,
          quotaBytes: 5000000000n,
        }),
      },
      file: { aggregate: async () => ({ _sum: { sizeBytes: 0n } }) },
    } as unknown as Parameters<typeof checkUserQuotaAndStatus>[2];

    await expect(
      checkUserQuotaAndStatus('u1', 1000n, mockPrisma),
    ).rejects.toEqual(
      expect.objectContaining({
        status_code: 403,
        body: expect.stringContaining('ACCOUNT_SUSPENDED'),
      }),
    );
  });

  it('menolak upload bila kuota habis dengan 403', async () => {
    const mockPrisma = {
      user: {
        findUnique: async () => ({
          status: UserStatus.ACTIVE,
          quotaBytes: 1000n,
        }),
      },
      file: {
        aggregate: async () => ({
          _sum: { sizeBytes: 800n },
        }),
      },
    } as unknown as Parameters<typeof checkUserQuotaAndStatus>[2];

    // Pemakaian 800 + upload 300 = 1100 > kuota 1000
    await expect(
      checkUserQuotaAndStatus('u1', 300n, mockPrisma),
    ).rejects.toEqual(
      expect.objectContaining({
        status_code: 403,
        body: expect.stringContaining('QUOTA_EXCEEDED'),
      }),
    );
  });

  it('lolos bila kuota mencukupi', async () => {
    const mockPrisma = {
      user: {
        findUnique: async () => ({
          status: UserStatus.ACTIVE,
          quotaBytes: 1000n,
        }),
      },
      file: {
        aggregate: async () => ({
          _sum: { sizeBytes: 500n },
        }),
      },
    } as unknown as Parameters<typeof checkUserQuotaAndStatus>[2];

    await expect(
      checkUserQuotaAndStatus('u1', 400n, mockPrisma),
    ).resolves.toBeUndefined();
  });
});

describe('sniffAndValidateFile (US-18)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'galeriku-sniff-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('mendeteksi PNG asli dengan benar', async () => {
    const pngPath = join(tempDir, 'sample.png');
    // Header minimal PNG
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48,
      0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 0x90, 0x77, 0x53,
      0xde,
    ]);
    await writeFile(pngPath, pngHeader);

    const res = await sniffAndValidateFile(
      pngPath,
      26214400n,
      2147483648n,
    );
    expect(res.mime).toBe('image/png');
    expect(res.kind).toBe('image');
  });

  it('tetap meloloskan file PNG valid yang memiliki metadata SVG (mis. XMP/C2PA)', async () => {
    const pngPath = join(tempDir, 'valid-with-svg-meta.png');
    // Header minimal PNG valid + metadata yang mengandung substring '<svg'
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48,
      0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 0x90, 0x77, 0x53,
      0xde,
    ]);
    const pngWithMeta = Buffer.concat([
      pngHeader,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">...</svg>'),
    ]);
    await writeFile(pngPath, pngWithMeta);

    const res = await sniffAndValidateFile(
      pngPath,
      26214400n,
      2147483648n,
    );
    expect(res.mime).toBe('image/png');
    expect(res.kind).toBe('image');
  });

  it('mendeteksi JPEG asli dengan benar', async () => {
    const jpgPath = join(tempDir, 'sample.jpg');
    // Header minimal JPEG
    const jpgHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xd9,
    ]);
    await writeFile(jpgPath, jpgHeader);

    const res = await sniffAndValidateFile(
      jpgPath,
      26214400n,
      2147483648n,
    );
    expect(res.mime).toBe('image/jpeg');
    expect(res.kind).toBe('image');
  });

  it('menolak teks SVG yang disamarkan sebagai gambar (PRD §11)', async () => {
    const fakeJpg = join(tempDir, 'palsu.jpg');
    await writeFile(
      fakeJpg,
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>',
    );

    await expect(
      sniffAndValidateFile(fakeJpg, 26214400n, 2147483648n),
    ).rejects.toEqual(
      expect.objectContaining({
        status_code: 415,
        body: expect.stringContaining('Format SVG tidak diizinkan'),
      }),
    );
  });

  it('menolak file biner bukan media (mis. teks biasa)', async () => {
    const textFile = join(tempDir, 'dokumen.txt');
    await writeFile(textFile, 'Halo, ini bukan file gambar atau video.');

    await expect(
      sniffAndValidateFile(textFile, 26214400n, 2147483648n),
    ).rejects.toEqual(
      expect.objectContaining({
        status_code: 415,
        body: expect.stringContaining('Format file tidak didukung'),
      }),
    );
  });
});

describe('resolveMediaDir/tusDirOf (US-17)', () => {
  const semula = process.env.MEDIA_DIR;

  afterEach(() => {
    if (semula === undefined) {
      delete process.env.MEDIA_DIR;
    } else {
      process.env.MEDIA_DIR = semula;
    }
  });

  it('memakai MEDIA_DIR bila diisi, cwd bila kosong', () => {
    process.env.MEDIA_DIR = '/data/media';
    expect(resolveMediaDir()).toBe('/data/media');
    process.env.MEDIA_DIR = '   ';
    expect(resolveMediaDir()).toBe(process.cwd());
    delete process.env.MEDIA_DIR;
    expect(resolveMediaDir()).toBe(process.cwd());
  });

  it('tusDirOf menunjuk sub-direktori _tus', () => {
    expect(tusDirOf('/data/media').endsWith('_tus')).toBe(true);
  });
});
