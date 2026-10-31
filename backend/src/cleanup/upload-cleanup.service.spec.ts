import type { UploadsService } from '../uploads/uploads.service';
import { UploadCleanupService } from './upload-cleanup.service';

describe('UploadCleanupService (US-17)', () => {
  function buatLayanan(terhapus: number) {
    let panggilan = 0;
    const uploads = {
      deleteExpiredUploads: async (): Promise<number> => {
        panggilan += 1;
        return terhapus;
      },
      panggilan: () => panggilan,
    };
    const service = new UploadCleanupService(uploads as unknown as UploadsService);
    return { service, uploads };
  }

  it('mengembalikan hitungan upload yatim yang dihapus', async () => {
    const { service, uploads } = buatLayanan(3);
    await expect(service.runOnce()).resolves.toEqual({ uploads: 3 });
    expect(uploads.panggilan()).toBe(1);
  });

  it('tidak tumpang tindih dan mengembalikan nol saat sibuk', async () => {
    const { service, uploads } = buatLayanan(3);
    (service as unknown as { running: boolean }).running = true;
    await expect(service.runOnce()).resolves.toEqual({ uploads: 0 });
    expect(uploads.panggilan()).toBe(0);
  });
});
