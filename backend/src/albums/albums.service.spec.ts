import { FileKind, FileStatus } from '../generated/prisma/client';
import { ApiError } from '../common/errors/api-error';
import { AlbumsService } from './albums.service';

describe('AlbumsService', () => {
  it('membuat album baru dengan benar', async () => {
    const now = new Date();
    const fakePrisma: any = {
      album: {
        findMany: async () => [],
        create: async ({ data }: any) => ({
          id: 'alb-1',
          ownerId: data.ownerId,
          title: data.title,
          parentId: data.parentId ?? null,
          coverFileId: null,
          createdAt: now,
        }),
      },
    };

    const service = new AlbumsService(fakePrisma);
    const res = await service.createAlbum('u-1', { title: 'Liburan Bali' });
    expect(res).toEqual({
      id: 'alb-1',
      title: 'Liburan Bali',
      parentId: null,
      coverFileId: null,
      fileCount: 0,
      childCount: 0,
      createdAt: now.toISOString(),
    });
  });

  it('menolak pembuatan album dengan judul sama di induk yang sama (case-insensitive 409)', async () => {
    const fakePrisma: any = {
      album: {
        findMany: async () => [{ id: 'alb-lama', title: 'Liburan Bali' }],
      },
    };

    const service = new AlbumsService(fakePrisma);
    await expect(
      service.createAlbum('u-1', { title: 'liburan bali' }),
    ).rejects.toThrow(ApiError);
  });

  it('menolak kedalaman album melebihi 4 tingkat (400 MAX_DEPTH_EXCEEDED)', async () => {
    const fakePrisma: any = {
      album: {
        findUnique: async ({ where }: any) => {
          if (where.id === 'lvl-4') return { id: 'lvl-4', ownerId: 'u-1', parentId: 'lvl-3' };
          if (where.id === 'lvl-3') return { id: 'lvl-3', ownerId: 'u-1', parentId: 'lvl-2' };
          if (where.id === 'lvl-2') return { id: 'lvl-2', ownerId: 'u-1', parentId: 'lvl-1' };
          if (where.id === 'lvl-1') return { id: 'lvl-1', ownerId: 'u-1', parentId: null };
          return null;
        },
      },
    };

    const service = new AlbumsService(fakePrisma);
    await expect(
      service.createAlbum('u-1', { title: 'Lembah 5', parentId: 'lvl-4' }),
    ).rejects.toThrow(ApiError);
  });

  it('mengembalikan 404 jika album bukan milik pengguna', async () => {
    const fakePrisma: any = {
      album: {
        findUnique: async () => ({
          id: 'alb-1',
          ownerId: 'u-other',
          title: 'Rahasia',
        }),
      },
    };

    const service = new AlbumsService(fakePrisma);
    await expect(service.getAlbumDetail('u-1', 'alb-1')).rejects.toThrow(
      ApiError,
    );
  });

  it('menambah file ke album dan menyetel cover otomatis dari file pertama', async () => {
    const now = new Date();
    let updatedCover: string | null = null;
    let callCount = 0;

    const fakePrisma: any = {
      album: {
        findUnique: async () => {
          callCount += 1;
          if (callCount === 1) {
            return {
              id: 'alb-1',
              ownerId: 'u-1',
              title: 'Liburan Bali',
              coverFileId: null,
              albumFiles: [],
            };
          }
          return {
            id: 'alb-1',
            ownerId: 'u-1',
            title: 'Liburan Bali',
            coverFileId: updatedCover,
            createdAt: now,
            coverFile: null,
            albumFiles: [
              {
                position: 1,
                file: {
                  id: 'f-1',
                  originalName: 'pantai.jpg',
                  mimeType: 'image/jpeg',
                  sizeBytes: 1024n,
                  kind: FileKind.image,
                  width: 800,
                  height: 600,
                  durationS: null,
                  thumbKey: 'pantai.thumb.webp',
                  status: FileStatus.ready,
                  takenAt: null,
                  createdAt: now,
                },
              },
            ],
          };
        },
        update: async ({ data }: any) => {
          updatedCover = data.coverFileId;
          return {};
        },
      },
      file: {
        findMany: async () => [{ id: 'f-1' }],
      },
      albumFile: {
        create: async () => ({}),
      },
      $transaction: async (promises: any[]) => Promise.all(promises),
    };

    const service = new AlbumsService(fakePrisma);
    const res = await service.addFilesToAlbum('u-1', 'alb-1', {
      fileIds: ['f-1'],
    });

    expect(updatedCover).toBe('f-1');
    expect(res.fileCount).toBe(1);
    expect(res.files[0].id).toBe('f-1');
  });
});
