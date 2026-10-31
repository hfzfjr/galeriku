import { FileKind, FileStatus } from '../generated/prisma/client';
import { ApiError } from '../common/errors/api-error';
import { AlbumsService } from './albums.service';

describe('AlbumsService', () => {
  it('membuat album baru dengan benar', async () => {
    const now = new Date();
    const fakePrisma: any = {
      album: {
        create: async ({ data }: any) => ({
          id: 'alb-1',
          ownerId: data.ownerId,
          title: data.title,
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
      coverFileId: null,
      fileCount: 0,
      createdAt: now.toISOString(),
    });
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
