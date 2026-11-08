import { stripJpegExif } from './strip-exif';

describe('stripJpegExif (RF-21: Pembersihan GPS/EXIF JPEG Lossless)', () => {
  it('mengembalikan buffer apa adanya bila bukan JPEG', () => {
    const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(stripJpegExif(pngBuf)).toEqual(pngBuf);
  });

  it('membuang segmen APP1 (0xFF 0xE1) dan mempertahankan segmen lain', () => {
    // Bangun JPEG sintetis:
    // SOI: FF D8
    // APP0 (JFIF): FF E0 00 05 01 02 03
    // APP1 (EXIF): FF E1 00 06 45 78 69 66
    // SOS: FF DA ... EOI: FF D9
    const soi = Buffer.from([0xff, 0xd8]);
    const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x05, 0x01, 0x02, 0x03]);
    const app1 = Buffer.from([0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66]); // "Exif"
    const sosAndData = Buffer.from([0xff, 0xda, 0x00, 0x02, 0xaa, 0xbb, 0xff, 0xd9]);

    const originalJpeg = Buffer.concat([soi, app0, app1, sosAndData]);
    const strippedJpeg = stripJpegExif(originalJpeg);

    // Pastikan APP1 tidak ada lagi di dalam strippedJpeg
    expect(strippedJpeg.includes(Buffer.from([0xff, 0xe1]))).toBe(false);

    // Pastikan APP0 dan SOS tetap utuh
    expect(strippedJpeg.includes(app0)).toBe(true);
    expect(strippedJpeg.includes(sosAndData)).toBe(true);

    // Panjang berkurang tepat sebesar segmen APP1
    expect(strippedJpeg.length).toBe(originalJpeg.length - app1.length);
  });

  it('tidak mengubah JPEG yang sudah tanpa APP1', () => {
    const soi = Buffer.from([0xff, 0xd8]);
    const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x05, 0x01, 0x02, 0x03]);
    const sosAndData = Buffer.from([0xff, 0xda, 0x00, 0x02, 0xaa, 0xbb, 0xff, 0xd9]);
    const jpegTanpaApp1 = Buffer.concat([soi, app0, sosAndData]);

    const result = stripJpegExif(jpegTanpaApp1);
    expect(result).toEqual(jpegTanpaApp1);
  });
});
