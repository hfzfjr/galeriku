import { jest } from '@jest/globals';
import {
  parseIso6709,
  VideoProcessingService,
} from './video-processing.service';

describe('VideoProcessingService (RF-34)', () => {
  describe('parseIso6709', () => {
    it('mengurai koordinat ISO 6709 standar tanpa elevasi', () => {
      const res = parseIso6709('+07.1234-110.5678/');
      expect(res).toEqual({
        lat: 7.1234,
        lng: -110.5678,
        altM: null,
      });
    });

    it('mengurai koordinat ISO 6709 dengan elevasi', () => {
      const res = parseIso6709('-06.2088+106.8456+050.250/');
      expect(res).toEqual({
        lat: -6.2088,
        lng: 106.8456,
        altM: 50.25,
      });
    });

    it('menolak string tidak valid atau nilai di luar rentang', () => {
      expect(parseIso6709(undefined)).toBeNull();
      expect(parseIso6709('')).toBeNull();
      expect(parseIso6709('invalid-coords')).toBeNull();
      expect(parseIso6709('+95.0000+10.0000/')).toBeNull(); // lat > 90
      expect(parseIso6709('+10.0000+190.0000/')).toBeNull(); // lng > 180
    });
  });

  describe('extractMetadata', () => {
    it('mengekstrak durasi, resolusi, creation_time, GPS, dan kamera dari output ffprobe', async () => {
      const service = new VideoProcessingService();

      const mockStdout = JSON.stringify({
        streams: [
          {
            codec_type: 'video',
            width: 1920,
            height: 1080,
            duration: '45.500000',
            tags: {
              creation_time: '2024-05-15T08:30:00.000000Z',
            },
          },
        ],
        format: {
          duration: '45.500000',
          tags: {
            make: 'Apple',
            model: 'iPhone 15 Pro',
            location: '+07.1234-110.5678/',
          },
        },
      });

      const mockRunner = jest.fn().mockResolvedValue({ stdout: mockStdout, stderr: '' });

      const meta = await service.extractMetadata('video.mp4', mockRunner as any);

      expect(mockRunner).toHaveBeenCalledWith(
        'ffprobe',
        expect.arrayContaining(['-print_format', 'json', 'video.mp4']),
        expect.any(Object),
      );

      expect(meta.durationS).toBe(45.5);
      expect(meta.width).toBe(1920);
      expect(meta.height).toBe(1080);
      expect(meta.creationTime).toEqual(new Date('2024-05-15T08:30:00.000000Z'));
      expect(meta.cameraMake).toBe('Apple');
      expect(meta.cameraModel).toBe('iPhone 15 Pro');
      expect(meta.gpsLat).toBe(7.1234);
      expect(meta.gpsLng).toBe(-110.5678);
    });

    it('menukar width dan height bila orientasi rotasi adalah 90 atau 270 derajat', async () => {
      const service = new VideoProcessingService();

      const mockStdout = JSON.stringify({
        streams: [
          {
            codec_type: 'video',
            width: 1920,
            height: 1080,
            tags: {
              rotate: '90',
            },
          },
        ],
      });

      const mockRunner = jest.fn().mockResolvedValue({ stdout: mockStdout, stderr: '' });

      const meta = await service.extractMetadata('portrait.mov', mockRunner as any);

      expect(meta.width).toBe(1080);
      expect(meta.height).toBe(1920);
    });

    it('mengembalikan fallback aman jika ffprobe gagal atau file korup', async () => {
      const service = new VideoProcessingService();

      const mockRunner = jest.fn().mockRejectedValue(new Error('ffprobe: file format not recognized'));

      const meta = await service.extractMetadata('corrupt.mp4', mockRunner as any);

      expect(meta).toEqual({
        durationS: null,
        width: null,
        height: null,
        creationTime: null,
        gpsLat: null,
        gpsLng: null,
        gpsAltM: null,
        cameraMake: null,
        cameraModel: null,
        contentIdentifier: null,
      });
    });
  });

  describe('generatePoster', () => {
    it('menjalankan ffmpeg dengan seek time wajar (~10% durasi)', async () => {
      const service = new VideoProcessingService();
      const mockRunner = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });
      const mockChecker = jest.fn().mockReturnValue(true);

      const ok = await service.generatePoster(
        'input.mp4',
        'poster.webp',
        30,
        mockRunner as any,
        mockChecker as any,
      );

      expect(ok).toBe(true);
      expect(mockRunner).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-ss',
          '3.00',
          '-i',
          'input.mp4',
          '-vf',
          'scale=400:400:force_original_aspect_ratio=decrease',
          '-c:v',
          'libwebp',
          'poster.webp',
        ]),
        expect.any(Object),
      );
    });

    it('mengembalikan false tanpa melempar error jika ffmpeg gagal', async () => {
      const service = new VideoProcessingService();
      const mockRunner = jest.fn().mockRejectedValue(new Error('ffmpeg failed'));

      const ok = await service.generatePoster('input.mp4', 'poster.webp', 30, mockRunner as any);

      expect(ok).toBe(false);
    });
  });
});
