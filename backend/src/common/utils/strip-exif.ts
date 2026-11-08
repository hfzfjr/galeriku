/**
 * Utilitas pembersih metadata EXIF/XMP dari berkas JPEG secara lossless (RF-21).
 * Menghapus segmen APP1 (0xFF 0xE1) yang memuat Exif dan XMP tanpa melakukan
 * re-encoding piksel (kualitas gambar dan kompresi asli tetap 100% terjaga).
 */
export function stripJpegExif(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return buf;
  }

  const chunks: Buffer[] = [buf.subarray(0, 2)]; // Simpan SOI (FF D8)
  let pos = 2;

  while (pos < buf.length) {
    if (buf[pos] !== 0xff) {
      chunks.push(buf.subarray(pos));
      break;
    }

    // Lewati padding byte 0xFF beruntun
    while (pos < buf.length && buf[pos] === 0xff) {
      pos++;
    }

    if (pos >= buf.length) break;

    const marker = buf[pos++];

    // Marker mandiri tanpa panjang payload
    if (marker === 0xd9) {
      // EOI (End of Image)
      chunks.push(Buffer.from([0xff, 0xd9]));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      // TEM atau RST marker
      chunks.push(Buffer.from([0xff, marker]));
      continue;
    }

    // SOS (Start of Scan) - penanda awal aliran bitstream gambar terkompresi
    if (marker === 0xda) {
      chunks.push(buf.subarray(pos - 2));
      break;
    }

    if (pos + 2 > buf.length) {
      chunks.push(buf.subarray(pos - 2));
      break;
    }

    const length = (buf[pos] << 8) | buf[pos + 1];
    const segmentEnd = pos + length;

    if (segmentEnd > buf.length) {
      chunks.push(buf.subarray(pos - 2));
      break;
    }

    // APP1 marker (0xE1) menyimpan EXIF dan XMP (termasuk koordinat GPS)
    if (marker === 0xe1) {
      // Buang segmen ini dari output
      pos = segmentEnd;
    } else {
      // Pertahankan segmen lain (APP0 JFIF, DQT, DHT, SOF0, dll.)
      chunks.push(buf.subarray(pos - 2, segmentEnd));
      pos = segmentEnd;
    }
  }

  return Buffer.concat(chunks);
}

