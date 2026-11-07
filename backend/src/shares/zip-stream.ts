import { Readable } from 'node:stream';
import { crc32 } from 'node:zlib';

export interface ZipEntry {
  filename: string;
  getStream: () => NodeJS.ReadableStream;
}

interface CentralDirectoryEntry {
  filename: string;
  crc: number;
  size: bigint;
  offset: bigint;
  dosTime: number;
  dosDate: number;
}

const LIMIT_32BIT = 0xffffffffn;
const LIMIT_16BIT = 0xffff;

function getDosDateTime(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  return { dosDate, dosTime };
}

/**
 * Streaming ZIP generator (Store mode - method 0) tanpa dependency pihak ketiga.
 * Mendukung ZIP64 otomatis (RF-02 / B9) saat offset, ukuran, atau jumlah entri
 * melewati batas 32-bit (4 GiB) atau 16-bit (65535 berkas).
 * Memenuhi kriteria US-28: streaming tanpa kompresi dan tanpa file sementara di disk.
 */
export function createZipStream(entries: ZipEntry[]): NodeJS.ReadableStream {
  return Readable.from(
    (async function* () {
      const cdEntries: CentralDirectoryEntry[] = [];
      let currentOffset = 0n;
      const { dosDate, dosTime } = getDosDateTime();

      // Gunakan penomoran jika ada nama file yang sama
      const usedFilenames = new Map<string, number>();

      for (const entry of entries) {
        let finalName = entry.filename.replace(/[/\\?%*:|"<>]/g, '_');
        if (!finalName) finalName = 'file';

        const count = usedFilenames.get(finalName) ?? 0;
        usedFilenames.set(finalName, count + 1);
        if (count > 0) {
          const dotIdx = finalName.lastIndexOf('.');
          if (dotIdx > 0) {
            finalName = `${finalName.slice(0, dotIdx)} (${count})${finalName.slice(dotIdx)}`;
          } else {
            finalName = `${finalName} (${count})`;
          }
        }

        const filenameBuf = Buffer.from(finalName, 'utf-8');
        const offset = currentOffset;

        // Local file header (30 bytes + filename)
        // Bit 3 (data descriptor) aktif: CRC dan ukuran di header diisi 0,
        // ukuran sesungguhnya ditulis di data descriptor setelah konten file.
        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
        localHeader.writeUInt16LE(45, 4); // Version needed to extract (4.5 untuk kompatibilitas ZIP64)
        localHeader.writeUInt16LE(0x0808, 6); // Bit 3 (data descriptor) + Bit 11 (UTF-8 filename)
        localHeader.writeUInt16LE(0, 8); // Compression method (0 = store)
        localHeader.writeUInt16LE(dosTime, 10);
        localHeader.writeUInt16LE(dosDate, 12);
        localHeader.writeUInt32LE(0, 14); // CRC-32 (0 saat bit 3 aktif)
        localHeader.writeUInt32LE(0, 18); // Compressed size
        localHeader.writeUInt32LE(0, 22); // Uncompressed size
        localHeader.writeUInt16LE(filenameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28); // Extra field length

        yield localHeader;
        yield filenameBuf;
        currentOffset += BigInt(localHeader.length + filenameBuf.length);

        let entryCrc = 0;
        let entrySize = 0n;
        const stream = entry.getStream();

        for await (const chunk of stream) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          entryCrc = crc32(buf, entryCrc);
          entrySize += BigInt(buf.length);
          currentOffset += BigInt(buf.length);
          yield buf;
        }

        // Data descriptor:
        // Jika ukuran file >= 4 GiB (0xFFFFFFFF), gunakan descriptor ZIP64 (8-byte sizes, total 24 bytes).
        // Selain itu gunakan descriptor standar 32-bit (4-byte sizes, total 16 bytes).
        if (entrySize >= LIMIT_32BIT) {
          const descriptor = Buffer.alloc(24);
          descriptor.writeUInt32LE(0x08074b50, 0); // Data descriptor signature
          descriptor.writeUInt32LE(entryCrc >>> 0, 4);
          descriptor.writeBigUInt64LE(entrySize, 8);
          descriptor.writeBigUInt64LE(entrySize, 16);
          yield descriptor;
          currentOffset += BigInt(descriptor.length);
        } else {
          const descriptor = Buffer.alloc(16);
          descriptor.writeUInt32LE(0x08074b50, 0); // Data descriptor signature
          descriptor.writeUInt32LE(entryCrc >>> 0, 4);
          descriptor.writeUInt32LE(Number(entrySize), 8);
          descriptor.writeUInt32LE(Number(entrySize), 12);
          yield descriptor;
          currentOffset += BigInt(descriptor.length);
        }

        cdEntries.push({
          filename: finalName,
          crc: entryCrc >>> 0,
          size: entrySize,
          offset,
          dosDate,
          dosTime,
        });
      }

      // Central Directory
      const cdStartOffset = currentOffset;
      let cdSize = 0n;

      for (const cd of cdEntries) {
        const filenameBuf = Buffer.from(cd.filename, 'utf-8');

        // Periksa apakah entri ini memerlukan Extra Field ZIP64
        const needsZip64Size = cd.size >= LIMIT_32BIT;
        const needsZip64Offset = cd.offset >= LIMIT_32BIT;
        const needsZip64Extra = needsZip64Size || needsZip64Offset;

        let extraBuf = Buffer.alloc(0);
        if (needsZip64Extra) {
          // Extra field format:
          // Tag: 0x0001 (2 byte)
          // Size: 2 byte
          // Uncompressed size (8 byte) [jika size >= 0xFFFFFFFF]
          // Compressed size (8 byte) [jika size >= 0xFFFFFFFF]
          // Relative header offset (8 byte) [jika offset >= 0xFFFFFFFF]
          const extraSize = (needsZip64Size ? 16 : 0) + (needsZip64Offset ? 8 : 0);
          extraBuf = Buffer.alloc(4 + extraSize);
          extraBuf.writeUInt16LE(0x0001, 0);
          extraBuf.writeUInt16LE(extraSize, 2);

          let extraPos = 4;
          if (needsZip64Size) {
            extraBuf.writeBigUInt64LE(cd.size, extraPos);
            extraBuf.writeBigUInt64LE(cd.size, extraPos + 8);
            extraPos += 16;
          }
          if (needsZip64Offset) {
            extraBuf.writeBigUInt64LE(cd.offset, extraPos);
          }
        }

        const cdHeader = Buffer.alloc(46);
        cdHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
        cdHeader.writeUInt16LE(45, 4); // Version made by (4.5)
        cdHeader.writeUInt16LE(needsZip64Extra ? 45 : 20, 6); // Version needed to extract
        cdHeader.writeUInt16LE(0x0808, 8); // Bit 3 + UTF-8
        cdHeader.writeUInt16LE(0, 10); // Method: Store
        cdHeader.writeUInt16LE(cd.dosTime, 12);
        cdHeader.writeUInt16LE(cd.dosDate, 14);
        cdHeader.writeUInt32LE(cd.crc, 16);
        cdHeader.writeUInt32LE(needsZip64Size ? 0xffffffff : Number(cd.size), 20); // Compressed size
        cdHeader.writeUInt32LE(needsZip64Size ? 0xffffffff : Number(cd.size), 24); // Uncompressed size
        cdHeader.writeUInt16LE(filenameBuf.length, 28);
        cdHeader.writeUInt16LE(extraBuf.length, 30); // Extra field length
        cdHeader.writeUInt16LE(0, 32); // File comment length
        cdHeader.writeUInt16LE(0, 34); // Disk number start
        cdHeader.writeUInt16LE(0, 36); // Internal file attributes
        cdHeader.writeUInt32LE(0, 38); // External file attributes
        cdHeader.writeUInt32LE(needsZip64Offset ? 0xffffffff : Number(cd.offset), 42); // Relative offset

        yield cdHeader;
        yield filenameBuf;
        if (extraBuf.length > 0) {
          yield extraBuf;
        }

        const totalEntryLen = BigInt(cdHeader.length + filenameBuf.length + extraBuf.length);
        cdSize += totalEntryLen;
        currentOffset += totalEntryLen;
      }

      // Tentukan apakah arsip secara keseluruhan memerlukan ZIP64 EOCD:
      // - Jumlah entri >= 65535
      // - Ukuran Central Directory >= 4 GiB
      // - Offset mulai Central Directory >= 4 GiB
      // - Salah satu file berukuran >= 4 GiB atau offset >= 4 GiB
      const requiresZip64 =
        cdEntries.length >= LIMIT_16BIT ||
        cdSize >= LIMIT_32BIT ||
        cdStartOffset >= LIMIT_32BIT ||
        cdEntries.some((e) => e.size >= LIMIT_32BIT || e.offset >= LIMIT_32BIT);

      if (requiresZip64) {
        // Zip64 End of Central Directory Record (56 byte)
        const zip64EocdOffset = currentOffset;
        const zip64Eocd = Buffer.alloc(56);
        zip64Eocd.writeUInt32LE(0x06064b50, 0); // Zip64 EOCD signature
        zip64Eocd.writeBigUInt64LE(44n, 4); // Size of remaining zip64 EOCD record
        zip64Eocd.writeUInt16LE(45, 12); // Version made by (4.5)
        zip64Eocd.writeUInt16LE(45, 14); // Version needed to extract (4.5)
        zip64Eocd.writeUInt32LE(0, 16); // Number of this disk
        zip64Eocd.writeUInt32LE(0, 20); // Disk with start of CD
        zip64Eocd.writeBigUInt64LE(BigInt(cdEntries.length), 24); // Number of CD records on disk
        zip64Eocd.writeBigUInt64LE(BigInt(cdEntries.length), 32); // Total CD records
        zip64Eocd.writeBigUInt64LE(cdSize, 40); // Size of central directory
        zip64Eocd.writeBigUInt64LE(cdStartOffset, 48); // Offset of start of CD

        yield zip64Eocd;
        currentOffset += BigInt(zip64Eocd.length);

        // Zip64 End of Central Directory Locator (20 byte)
        const zip64Locator = Buffer.alloc(20);
        zip64Locator.writeUInt32LE(0x07064b50, 0); // Zip64 locator signature
        zip64Locator.writeUInt32LE(0, 4); // Number of disk with start of Zip64 EOCD
        zip64Locator.writeBigUInt64LE(zip64EocdOffset, 8); // Offset of Zip64 EOCD
        zip64Locator.writeUInt32LE(1, 16); // Total number of disks

        yield zip64Locator;
        currentOffset += BigInt(zip64Locator.length);
      }

      // End of Central Directory standar (EOCD, 22 byte)
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
      eocd.writeUInt16LE(0, 4); // Number of this disk
      eocd.writeUInt16LE(0, 6); // Disk where central directory starts
      eocd.writeUInt16LE(
        cdEntries.length >= LIMIT_16BIT ? LIMIT_16BIT : cdEntries.length,
        8,
      ); // Number of CD records on this disk
      eocd.writeUInt16LE(
        cdEntries.length >= LIMIT_16BIT ? LIMIT_16BIT : cdEntries.length,
        10,
      ); // Total number of CD records
      eocd.writeUInt32LE(
        cdSize >= LIMIT_32BIT ? 0xffffffff : Number(cdSize),
        12,
      ); // Size of central directory
      eocd.writeUInt32LE(
        cdStartOffset >= LIMIT_32BIT ? 0xffffffff : Number(cdStartOffset),
        16,
      ); // Offset of start of CD
      eocd.writeUInt16LE(0, 20); // Comment length

      yield eocd;
    })(),
  );
}
