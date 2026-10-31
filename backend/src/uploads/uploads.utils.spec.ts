import {
  FALLBACK_ORIGINAL_NAME,
  inferKind,
  resolveMediaDir,
  sanitizeOriginalName,
  tusDirOf,
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

describe('inferKind (US-17, sementara sampai US-18)', () => {
  it('mime video/* menjadi video', () => {
    expect(inferKind('video/mp4', 'tanpa-ekstensi')).toBe('video');
    expect(inferKind('VIDEO/QUICKTIME', 'x')).toBe('video');
  });

  it('ekstensi video umum menjadi video walau mime generik', () => {
    expect(inferKind('application/octet-stream', 'klip.MP4')).toBe('video');
    expect(inferKind('application/octet-stream', 'a.mov')).toBe('video');
    expect(inferKind('application/octet-stream', 'a.webm')).toBe('video');
  });

  it('selainnya menjadi image', () => {
    expect(inferKind('image/jpeg', 'foto.jpg')).toBe('image');
    expect(inferKind('application/octet-stream', 'arsip.bin')).toBe('image');
    expect(inferKind('', '')).toBe('image');
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
