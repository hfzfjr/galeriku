import type { FilesService } from '../files/files.service';
import { TrashCleanupService } from './trash-cleanup.service';

describe('TrashCleanupService (RF-01)', () => {
  function buatLayanan(terhapus: number) {
    let panggilan = 0;
    let retentionUsed = 0;
    const files = {
      purgeExpiredTrash: async (
        retentionDays: number,
      ): Promise<{ count: number }> => {
        panggilan += 1;
        retentionUsed = retentionDays;
        return { count: terhapus };
      },
      panggilan: () => panggilan,
      retentionUsed: () => retentionUsed,
    };
    const service = new TrashCleanupService(files as unknown as FilesService);
    return { service, files };
  }

  it('mengembalikan hitungan file sampah kedaluwarsa yang dihapus dengan default 30 hari', async () => {
    delete process.env.TRASH_RETENTION_DAYS;
    const { service, files } = buatLayanan(5);
    await expect(service.runOnce()).resolves.toEqual({ files: 5 });
    expect(files.panggilan()).toBe(1);
    expect(files.retentionUsed()).toBe(30);
  });

  it('menggunakan TRASH_RETENTION_DAYS dari env bila tersedia', async () => {
    process.env.TRASH_RETENTION_DAYS = '14';
    try {
      const { service, files } = buatLayanan(2);
      await expect(service.runOnce()).resolves.toEqual({ files: 2 });
      expect(files.panggilan()).toBe(1);
      expect(files.retentionUsed()).toBe(14);
    } finally {
      delete process.env.TRASH_RETENTION_DAYS;
    }
  });

  it('tidak tumpang tindih dan mengembalikan nol saat sibuk', async () => {
    const { service, files } = buatLayanan(5);
    (service as unknown as { running: boolean }).running = true;
    await expect(service.runOnce()).resolves.toEqual({ files: 0 });
    expect(files.panggilan()).toBe(0);
  });
});

