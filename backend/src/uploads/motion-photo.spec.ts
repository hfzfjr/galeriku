import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectMotionPhoto } from './motion-photo';

describe('detectMotionPhoto (RF-31)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'motion-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  function createSyntheticMp4(length = 64): Buffer {
    const buf = Buffer.alloc(length, 0);
    // 4 byte box size
    buf.writeUInt32BE(length, 0);
    // 4 byte box type 'ftyp'
    buf.write('ftyp', 4, 'ascii');
    // 4 byte major brand
    buf.write('isom', 8, 'ascii');
    return buf;
  }

  it('mendeteksi Motion Photo format MicroVideoOffset (Google Camera v1)', async () => {
    const filePath = join(tempDir, 'gcam_v1.jpg');
    const mp4Buf = createSyntheticMp4(100);
    const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description xmlns:GCamera="http://ns.google.com/photos/1.0/camera/"
   GCamera:MotionPhoto="1"
   GCamera:MicroVideoOffset="${mp4Buf.length}"/>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    const jpegHead = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);
    const xmpBuf = Buffer.from(xmp, 'utf-8');
    const jpegBody = Buffer.alloc(1000, 0xee);

    const fullFile = Buffer.concat([jpegHead, xmpBuf, jpegBody, mp4Buf]);
    await writeFile(filePath, fullFile);

    const res = await detectMotionPhoto(filePath, fullFile.length);
    expect(res.isMotion).toBe(true);
    expect(res.length).toBe(BigInt(mp4Buf.length));
    expect(res.offset).toBe(BigInt(fullFile.length - mp4Buf.length));
  });

  it('mendeteksi Motion Photo format Container:Directory (Google Camera v2)', async () => {
    const filePath = join(tempDir, 'gcam_v2.jpg');
    const mp4Buf = createSyntheticMp4(200);
    const xmp = `<Container:Directory>
      <Container:Item Item:Mime="image/jpeg" Item:Semantic="Primary" Item:Length="800"/>
      <Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="${mp4Buf.length}"/>
    </Container:Directory>`;

    const jpegHead = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);
    const xmpBuf = Buffer.from(xmp, 'utf-8');
    const jpegBody = Buffer.alloc(800, 0xdd);

    const fullFile = Buffer.concat([jpegHead, xmpBuf, jpegBody, mp4Buf]);
    await writeFile(filePath, fullFile);

    const res = await detectMotionPhoto(filePath, fullFile.length);
    expect(res.isMotion).toBe(true);
    expect(res.length).toBe(BigInt(mp4Buf.length));
    expect(res.offset).toBe(BigInt(fullFile.length - mp4Buf.length));
  });

  it('menolak jika offset tidak diawali box ftyp MP4 yang valid', async () => {
    const filePath = join(tempDir, 'fake_motion.jpg');
    // Buat data ekor bukan ftyp (misal hanya bytes 0x00)
    const fakeMp4Buf = Buffer.alloc(100, 0x11);
    const xmp = `GCamera:MotionPhoto="1" GCamera:MicroVideoOffset="${fakeMp4Buf.length}"`;

    const jpegHead = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);
    const xmpBuf = Buffer.from(xmp, 'utf-8');
    const jpegBody = Buffer.alloc(1000, 0xee);

    const fullFile = Buffer.concat([jpegHead, xmpBuf, jpegBody, fakeMp4Buf]);
    await writeFile(filePath, fullFile);

    const res = await detectMotionPhoto(filePath, fullFile.length);
    expect(res.isMotion).toBe(false);
  });

  it('mengembalikan isMotion: false untuk JPEG normal tanpa tag motion photo', async () => {
    const filePath = join(tempDir, 'normal.jpg');
    const normalJpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(2000, 0xcc),
    ]);
    await writeFile(filePath, normalJpeg);

    const res = await detectMotionPhoto(filePath, normalJpeg.length);
    expect(res.isMotion).toBe(false);
  });
});
