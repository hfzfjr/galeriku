import {
  ADMIN_MAX_QUOTA_BYTES,
  adminUsersQuerySchema,
  updateQuotaRequestSchema,
} from '@galeriku/contracts';
import {
  decodeCursor,
  encodeCursor,
  toAdminUserItem,
} from './admin.service';

describe('cursor buram daftar admin', () => {
  it('bolak-balik id dan menolak bentuk rusak', () => {
    expect(decodeCursor(encodeCursor('u-123'))).toBe('u-123');
    expect(decodeCursor('bukan-base64!!!')).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(
      decodeCursor(Buffer.from(JSON.stringify({ lain: 1 })).toString('base64url')),
    ).toBeNull();
  });
});

describe('toAdminUserItem', () => {
  it('BigInt jadi string, tanpa rahasia, emailVerified boolean', () => {
    const item = toAdminUserItem(
      {
        id: 'u-1',
        name: 'Saya',
        email: 'saya@contoh.id',
        avatarUrl: null,
        role: 'USER',
        status: 'ACTIVE',
        emailVerifiedAt: new Date('2026-10-11T00:00:00.000Z'),
        quotaBytes: 5368709120n,
        createdAt: new Date('2026-10-10T00:00:00.000Z'),
        lastLoginAt: null,
      },
      1289748480n,
    );
    expect(item).toEqual({
      id: 'u-1',
      name: 'Saya',
      email: 'saya@contoh.id',
      avatarUrl: null,
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      quotaBytes: '5368709120',
      usedBytes: '1289748480',
      createdAt: '2026-10-10T00:00:00.000Z',
      lastLoginAt: null,
    });
    expect('passwordHash' in item).toBe(false);
    expect('googleSub' in item).toBe(false);
  });
});

describe('skema query daftar admin', () => {
  it('default q kosong dan limit 20', () => {
    expect(adminUsersQuerySchema.parse({})).toEqual({
      q: '',
      limit: 20,
      cursor: undefined,
    });
  });

  it('limit string ter-coerce, di luar 1..50 ditolak', () => {
    expect(adminUsersQuerySchema.parse({ limit: '5' }).limit).toBe(5);
    expect(() => adminUsersQuerySchema.parse({ limit: '0' })).toThrow();
    expect(() => adminUsersQuerySchema.parse({ limit: '51' })).toThrow();
    expect(() => adminUsersQuerySchema.parse({ limit: 'lima' })).toThrow();
    expect(() =>
      adminUsersQuerySchema.parse({ q: 'a'.repeat(101) }),
    ).toThrow();
  });
});

describe('skema ubah kuota admin', () => {
  it('batas maksimum 1000 GB', () => {
    expect(ADMIN_MAX_QUOTA_BYTES).toBe(1000n * 1024n * 1024n * 1024n);
    expect(
      updateQuotaRequestSchema.parse({ quotaBytes: '5368709120' }),
    ).toEqual({ quotaBytes: '5368709120' });
    expect(
      updateQuotaRequestSchema.parse({
        quotaBytes: ADMIN_MAX_QUOTA_BYTES.toString(),
      }).quotaBytes,
    ).toBe(ADMIN_MAX_QUOTA_BYTES.toString());
    expect(() =>
      updateQuotaRequestSchema.parse({
        quotaBytes: (ADMIN_MAX_QUOTA_BYTES + 1n).toString(),
      }),
    ).toThrow();
    expect(() => updateQuotaRequestSchema.parse({ quotaBytes: '-1' })).toThrow();
    expect(() =>
      updateQuotaRequestSchema.parse({ quotaBytes: '1.5' }),
    ).toThrow();
    expect(() =>
      updateQuotaRequestSchema.parse({ quotaBytes: 'lima GB' }),
    ).toThrow();
    expect(() =>
      updateQuotaRequestSchema.parse({ quotaBytes: '' }),
    ).toThrow();
  });
});
