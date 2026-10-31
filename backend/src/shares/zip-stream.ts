import { Readable } from 'node:stream';
import { crc32 } from 'node:zlib';

export interface ZipEntry {
  filename: string;
  getStream: () => NodeJS.ReadableStream;
}

interface CentralDirectoryEntry {
  filename: string;
  crc: number;
  size: number;
  offset: number;
  dosTime: number;
  dosDate: number;
}

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
 * Memenuhi kriteria US-28: streaming tanpa kompresi dan tanpa file sementara di disk.
 */
export function createZipStream(entries: ZipEntry[]): NodeJS.ReadableStream {
  return Readable.from(
    (async function* () {
      const cdEntries: CentralDirectoryEntry[] = [];
      let currentOffset = 0;
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
        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
        localHeader.writeUInt16LE(20, 4); // Version needed to extract (2.0)
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
        currentOffset += localHeader.length + filenameBuf.length;

        let entryCrc = 0;
        let entrySize = 0;
        const stream = entry.getStream();

        for await (const chunk of stream) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          entryCrc = crc32(buf, entryCrc);
          entrySize += buf.length;
          currentOffset += buf.length;
          yield buf;
        }

        // Data descriptor (16 bytes)
        const descriptor = Buffer.alloc(16);
        descriptor.writeUInt32LE(0x08074b50, 0); // Data descriptor signature
        descriptor.writeUInt32LE(entryCrc >>> 0, 4);
        descriptor.writeUInt32LE(entrySize >>> 0, 8);
        descriptor.writeUInt32LE(entrySize >>> 0, 12);

        yield descriptor;
        currentOffset += descriptor.length;

        cdEntries.push({
          filename: finalName,
          crc: entryCrc >>> 0,
          size: entrySize >>> 0,
          offset,
          dosDate,
          dosTime,
        });
      }

      // Central Directory
      const cdStartOffset = currentOffset;
      let cdSize = 0;

      for (const cd of cdEntries) {
        const filenameBuf = Buffer.from(cd.filename, 'utf-8');
        const cdHeader = Buffer.alloc(46);
        cdHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
        cdHeader.writeUInt16LE(20, 4); // Version made by (2.0)
        cdHeader.writeUInt16LE(20, 6); // Version needed to extract (2.0)
        cdHeader.writeUInt16LE(0x0808, 8); // Bit 3 + UTF-8
        cdHeader.writeUInt16LE(0, 10); // Method: Store
        cdHeader.writeUInt16LE(cd.dosTime, 12);
        cdHeader.writeUInt16LE(cd.dosDate, 14);
        cdHeader.writeUInt32LE(cd.crc, 16);
        cdHeader.writeUInt32LE(cd.size, 20); // Compressed size
        cdHeader.writeUInt32LE(cd.size, 24); // Uncompressed size
        cdHeader.writeUInt16LE(filenameBuf.length, 28);
        cdHeader.writeUInt16LE(0, 30); // Extra field length
        cdHeader.writeUInt16LE(0, 32); // File comment length
        cdHeader.writeUInt16LE(0, 34); // Disk number start
        cdHeader.writeUInt16LE(0, 36); // Internal file attributes
        cdHeader.writeUInt32LE(0, 38); // External file attributes
        cdHeader.writeUInt32LE(cd.offset, 42); // Relative offset of local header

        yield cdHeader;
        yield filenameBuf;
        const totalEntryLen = cdHeader.length + filenameBuf.length;
        cdSize += totalEntryLen;
        currentOffset += totalEntryLen;
      }

      // End of Central Directory (EOCD)
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
      eocd.writeUInt16LE(0, 4); // Number of this disk
      eocd.writeUInt16LE(0, 6); // Disk where central directory starts
      eocd.writeUInt16LE(cdEntries.length, 8); // Number of CD records on this disk
      eocd.writeUInt16LE(cdEntries.length, 10); // Total number of CD records
      eocd.writeUInt32LE(cdSize, 12); // Size of central directory
      eocd.writeUInt32LE(cdStartOffset, 16); // Offset of start of CD
      eocd.writeUInt16LE(0, 20); // Comment length

      yield eocd;
    })(),
  );
}

