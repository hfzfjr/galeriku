import { open } from 'node:fs/promises';

export interface MotionPhotoInfo {
  isMotion: boolean;
  offset?: bigint;
  length?: bigint;
}

/**
 * Mendeteksi Motion Photo Android (Google Camera / Samsung) pada berkas JPEG (RF-31).
 * Mengurai XMP untuk GCamera:MicroVideoOffset atau Container:Item (Item:Mime=video/mp4).
 * Memvalidasi bahwa offset + length berada dalam batas file dan diawali signature ftyp MP4.
 */
export async function detectMotionPhoto(
  filePath: string,
  totalFileSize: bigint | number,
): Promise<MotionPhotoInfo> {
  const size = BigInt(totalFileSize);
  if (size < 64n) {
    return { isMotion: false };
  }

  let handle;
  try {
    handle = await open(filePath, 'r');

    // Baca 512 KB pertama untuk memeriksa marker dan segmen XMP APP1
    const headSize = Number(size < 524288n ? size : 524288n);
    const headBuf = Buffer.alloc(headSize);
    await handle.read(headBuf, 0, headSize, 0);

    // Pastikan berformat JPEG (diawali SOI 0xFF 0xD8)
    if (headBuf[0] !== 0xff || headBuf[1] !== 0xd8) {
      return { isMotion: false };
    }

    const headStr = headBuf.toString('latin1');

    let videoLength: bigint | null = null;
    let videoOffset: bigint | null = null;

    // 1. Format MicroVideoOffset (Google Camera v1)
    const microVideoMatch = headStr.match(
      /(?:GCamera:)?MicroVideoOffset(?:=["']|>)\s*(\d+)/i,
    );
    if (microVideoMatch) {
      videoLength = BigInt(microVideoMatch[1]);
      videoOffset = size - videoLength;
    }

    // 2. Format Container Directory (Google Camera v2 / XMP Container)
    if (!videoOffset || !videoLength) {
      const containerItemMatch =
        headStr.match(
          /Item:Mime=["']video\/mp4["'][^>]*?Item:Length=["'](\d+)["']/i,
        ) ||
        headStr.match(
          /Item:Length=["'](\d+)["'][^>]*?Item:Mime=["']video\/mp4["']/i,
        );

      if (containerItemMatch) {
        videoLength = BigInt(containerItemMatch[1]);
        videoOffset = size - videoLength;
      }
    }

    // 3. Fallback format Samsung (MotionPhoto_Data)
    if (!videoOffset || !videoLength) {
      const samsungMatch = headStr.match(
        /MotionPhoto_Data(?:=["']|>)\s*(\d+)/i,
      );
      if (samsungMatch) {
        videoLength = BigInt(samsungMatch[1]);
        videoOffset = size - videoLength;
      }
    }

    if (!videoOffset || !videoLength) {
      return { isMotion: false };
    }

    // Validasi batas berkas
    if (
      videoOffset <= 0n ||
      videoLength <= 0n ||
      videoOffset + videoLength > size
    ) {
      return { isMotion: false };
    }

    // Validasi signature MP4: harus diawali box ber-type 'ftyp'
    // Format: 4 byte size + 4 byte 'ftyp'
    const ftypBuf = Buffer.alloc(16);
    await handle.read(ftypBuf, 0, 16, Number(videoOffset));

    const boxType = ftypBuf.subarray(4, 8).toString('ascii');
    if (boxType !== 'ftyp') {
      return { isMotion: false };
    }

    return {
      isMotion: true,
      offset: videoOffset,
      length: videoLength,
    };
  } catch {
    return { isMotion: false };
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
  }
}
