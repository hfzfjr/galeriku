import { FileStatus } from '../generated/prisma/client';
import { ApiError } from '../common/errors/api-error';
import { SharesService } from './shares.service';

describe('SharesService', () => {
  it('membuat share link untuk file dengan token 32 byte base64url', async () => {
    const fakePrisma: any = {
      file: {
        findUnique: async () => ({
          id: 'f-1',
          ownerId: 'u-1',
          originalName: 'foto.jpg',
          deletedAt: null,
          status: FileStatus.ready,
        }),
      },
      shareLink: {
        create: async ({ data }: any) => ({
          id: 'sh-1',
          token: data.token,
          ownerId: data.ownerId,
          targetType: data.targetType,
          targetId: data.targetId,
          allowDownload: data.allowDownload,
          viewCount: 0,
          expiresAt: null,
          passwordHash: null,
          revokedAt: null,
          createdAt: new Date(),
        }),
      },
    };

    const service = new SharesService(fakePrisma);
    const res = await service.createShare('u-1', {
      targetType: 'FILE',
      targetId: 'f-1',
      allowDownload: true,
    });

    expect(res.id).toBe('sh-1');
    expect(res.targetTitle).toBe('foto.jpg');
    expect(res.allowDownload).toBe(true);
    // 32 byte base64url adalah 43 karakter
    expect(res.token).toHaveLength(43);
  });

  it('mengembalikan 404 jika file bukan milik pengguna', async () => {
    const fakePrisma: any = {
      file: {
        findUnique: async () => ({
          id: 'f-1',
          ownerId: 'u-lain',
          originalName: 'foto.jpg',
          deletedAt: null,
          status: FileStatus.ready,
        }),
      },
    };

    const service = new SharesService(fakePrisma);
    await expect(
      service.createShare('u-1', {
        targetType: 'FILE',
        targetId: 'f-1',
        allowDownload: true,
      }),
    ).rejects.toThrow(ApiError);
  });
});
