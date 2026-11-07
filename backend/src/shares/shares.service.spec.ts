import { createHmac } from 'node:crypto';
import { FileStatus, ShareTarget } from '../generated/prisma/client';
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

  it('mencabut tautan dengan mengisi revokedAt', async () => {
    let updatedRevokedAt: Date | null = null;
    const fakePrisma: any = {
      shareLink: {
        findUnique: async () => ({
          id: 'sh-1',
          ownerId: 'u-1',
          token: 'tok-123',
          targetType: ShareTarget.file,
          targetId: 'f-1',
          allowDownload: true,
          viewCount: 2,
          expiresAt: null,
          passwordHash: null,
          revokedAt: updatedRevokedAt,
          createdAt: new Date(),
        }),
        update: async ({ data }: any) => {
          updatedRevokedAt = data.revokedAt;
          return { id: 'sh-1' };
        },
      },
      file: {
        findUnique: async () => ({ id: 'f-1', originalName: 'liburan.jpg' }),
      },
      album: {
        findUnique: async () => null,
      },
    };

    const service = new SharesService(fakePrisma);
    const res = await service.revokeShare('u-1', 'sh-1');
    expect(res.isRevoked).toBe(true);
    expect(updatedRevokedAt).toBeInstanceOf(Date);
  });

  it('mengembalikan 404 saat mencabut tautan milik pengguna lain (IDOR rule)', async () => {
    const fakePrisma: any = {
      shareLink: {
        findUnique: async () => ({
          id: 'sh-1',
          ownerId: 'u-lain',
          token: 'tok-123',
        }),
      },
    };

    const service = new SharesService(fakePrisma);
    await expect(service.revokeShare('u-1', 'sh-1')).rejects.toThrow(ApiError);
  });

  describe('Unlock Token HMAC & Expiry', () => {
    const fakeConfig: any = { ipHashSecret: 'kunci-rahasia-ip-123' };
    const service = new SharesService(
      {} as any,
      {} as any,
      fakeConfig,
    );

    it('menghasilkan token yang valid dan dapat diverifikasi', () => {
      const shareId = 'sh-test-1';
      const pwdHash = '$argon2id$v=19$m=65536,t=3,p=4$somehash';
      const token = service.generateUnlockToken(shareId, pwdHash);

      expect(typeof token).toBe('string');
      expect(token).toContain('.');

      const isValid = service.verifyUnlockToken(shareId, pwdHash, token);
      expect(isValid).toBe(true);
    });

    it('menolak token jika passwordHash berubah atau dihapus', () => {
      const shareId = 'sh-test-1';
      const pwdHashLama = '$argon2id$v=19$m=65536,t=3,p=4$hashLama';
      const token = service.generateUnlockToken(shareId, pwdHashLama);

      const pwdHashBaru = '$argon2id$v=19$m=65536,t=3,p=4$hashBaru';
      expect(service.verifyUnlockToken(shareId, pwdHashBaru, token)).toBe(false);
      expect(service.verifyUnlockToken(shareId, null, token)).toBe(false);
    });

    it('menolak token yang kedaluwarsa', () => {
      const shareId = 'sh-test-1';
      const pwdHash = '$argon2id$v=19$m=65536,t=3,p=4$somehash';
      const expiredTimestamp = Date.now() - 10_000;
      const fingerprint = service.getPasswordFingerprint(pwdHash);
      const payload = `${shareId}:${fingerprint}:${expiredTimestamp}`;
      const sig = createHmac('sha256', fakeConfig.ipHashSecret)
        .update(payload)
        .digest('hex');
      const expiredToken = `${expiredTimestamp}.${sig}`;

      expect(service.verifyUnlockToken(shareId, pwdHash, expiredToken)).toBe(false);
    });

    it('menolak token rusak atau signature salah', () => {
      const shareId = 'sh-test-1';
      const pwdHash = '$argon2id$v=19$m=65536,t=3,p=4$somehash';
      const validToken = service.generateUnlockToken(shareId, pwdHash);

      expect(service.verifyUnlockToken(shareId, pwdHash, undefined)).toBe(false);
      expect(service.verifyUnlockToken(shareId, pwdHash, 'token-tanpa-titik')).toBe(false);
      expect(service.verifyUnlockToken(shareId, pwdHash, `${validToken}bad`)).toBe(false);
      expect(service.verifyUnlockToken('sh-lain', pwdHash, validToken)).toBe(false);
    });
  });
});
