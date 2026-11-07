import { Readable } from 'node:stream';
import { createZipStream } from './zip-stream';

describe('createZipStream (RF-02 / B9)', () => {
  it('menghasilkan stream ZIP store standar yang valid untuk file kecil', async () => {
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

    // EOCD standar di akhir (0x06054b50)
    const eocdIndex = zipBuffer.lastIndexOf(
      Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    );
    expect(eocdIndex).toBeGreaterThan(0);
    expect(zipBuffer.readUInt16LE(eocdIndex + 8)).toBe(2);
    expect(zipBuffer.readUInt16LE(eocdIndex + 10)).toBe(2);

    // Karena < 4 GiB, tidak boleh ada ZIP64 EOCD
    const zip64EocdIndex = zipBuffer.indexOf(
      Buffer.from([0x50, 0x4b, 0x06, 0x06]),
    );
    expect(zip64EocdIndex).toBe(-1);
  });

  it('kegagalan di tengah stream mengakhiri aliran dengan error tanpa mengirim EOCD', async () => {
    async function* failingStream() {
      yield Buffer.from('bagian awal');
      throw new Error('Koneksi terputus mendadak');
    }

    const stream = createZipStream([
      {
        filename: 'rusak.dat',
        getStream: () => Readable.from(failingStream()),
      },
    ]);

    const chunks: Buffer[] = [];
    let caughtError: Error | null = null;
    try {
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).toBeTruthy();
    expect(caughtError?.message).toContain('Koneksi terputus');

    // Pastikan EOCD standar TIDAK terkirim di akhir saat gagal
    const merged = Buffer.concat(chunks);
    const eocdIndex = merged.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(eocdIndex).toBe(-1);
  });

  it('menghasilkan struktur ZIP64 valid saat ukuran melewati 4 GiB (aliran sintetis)', async () => {
    // 4.100 blok @ 1 MiB = 4.299.161.600 byte (> 4 GiB = 4.294.967.296 byte)
    // Gunakan kembali satu Buffer 1 MiB sintetis agar penggunaan RAM tetap 1 MiB
    const BLOCK_SIZE = 1024 * 1024; // 1 MiB
    const TOTAL_BLOCKS = 4100;
    const block = Buffer.alloc(BLOCK_SIZE, 0xaa);

    async function* largeSyntheticStream() {
      for (let i = 0; i < TOTAL_BLOCKS; i++) {
        yield block;
      }
    }

    const stream = createZipStream([
      {
        filename: 'video_besar.mp4',
        getStream: () => Readable.from(largeSyntheticStream()),
      },
    ]);

    let totalBytes = 0n;
    const tailChunks: Buffer[] = [];
    const TAIL_KEEP_BYTES = 4096;
    let tailLength = 0;

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += BigInt(buf.length);

      // Simpan hanya beberapa KB terakhir di memori untuk verifikasi struktur EOCD
      tailChunks.push(buf);
      tailLength += buf.length;
      while (tailLength > TAIL_KEEP_BYTES && tailChunks.length > 1) {
        const removed = tailChunks.shift()!;
        tailLength -= removed.length;
      }
    }

    expect(totalBytes).toBeGreaterThan(4n * 1024n * 1024n * 1024n);

    const tail = Buffer.concat(tailChunks);

    // 1. Verifikasi Zip64 End of Central Directory Record (0x06064b50)
    const zip64EocdIndex = tail.indexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06]));
    expect(zip64EocdIndex).toBeGreaterThan(-1);

    // 2. Verifikasi Zip64 End of Central Directory Locator (0x07064b50)
    const zip64LocatorIndex = tail.indexOf(
      Buffer.from([0x50, 0x4b, 0x06, 0x07]),
    );
    expect(zip64LocatorIndex).toBeGreaterThan(zip64EocdIndex);

    // 3. Verifikasi Standard EOCD (0x06054b50) dengan nilai 0xFFFFFFFF untuk ukuran/offset
    const eocdIndex = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(eocdIndex).toBeGreaterThan(zip64LocatorIndex);

    // Ukuran atau offset di EOCD standar harus 0xFFFFFFFF pada ZIP64
    const eocdCdSize = tail.readUInt32LE(eocdIndex + 12);
    const eocdCdOffset = tail.readUInt32LE(eocdIndex + 16);
    expect(eocdCdSize === 0xffffffff || eocdCdOffset === 0xffffffff).toBe(true);
  }, 30000); // 30 detik timeout untuk aliran sintetis 4.1 GB
});
