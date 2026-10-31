import { Readable } from 'node:stream';
import { createZipStream } from './zip-stream';

describe('createZipStream', () => {
  it('menghasilkan stream ZIP store yang valid', async () => {
    const stream = createZipStream([
      {
        filename: 'halo.txt',
        getStream: () => Readable.from([Buffer.from('Halo Dunia!')]),
      },
      {
        filename: 'catatan.txt',
        getStream: () => Readable.from([Buffer.from('Catatan kedua')]),
      },
    ]);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const zipBuffer = Buffer.concat(chunks);
    expect(zipBuffer.length).toBeGreaterThan(50);

    // Signature awal PK\x03\x04 (0x04034b50)
    expect(zipBuffer.readUInt32LE(0)).toBe(0x04034b50);

    // Cari signature End of Central Directory 0x06054b50 di akhir
    const eocdIndex = zipBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(eocdIndex).toBeGreaterThan(0);
    // 2 file tercatat di EOCD
    expect(zipBuffer.readUInt16LE(eocdIndex + 8)).toBe(2);
    expect(zipBuffer.readUInt16LE(eocdIndex + 10)).toBe(2);
  });
});

