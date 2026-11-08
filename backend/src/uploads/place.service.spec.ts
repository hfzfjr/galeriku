import { PlaceService } from './place.service';

describe('PlaceService (RF-16: Nama tempat offline)', () => {
  let service: PlaceService;

  beforeEach(() => {
    service = new PlaceService();
  });

  it('mengembalikan Jakarta untuk koordinat di Jakarta', () => {
    // Monas, Jakarta Pusat: -6.1754, 106.8272
    const result = service.resolve(-6.1754, 106.8272);
    expect(result).not.toBeNull();
    expect(result?.country).toBe('Indonesia');
    expect(result?.admin1).toBe('DKI Jakarta');
    expect(result?.city).toContain('Jakarta');
  });

  it('mengembalikan Denpasar / Bali untuk koordinat di Denpasar', () => {
    // Lapangan Puputan Badung, Denpasar: -8.6586, 115.2166
    const result = service.resolve(-8.6586, 115.2166);
    expect(result).not.toBeNull();
    expect(result?.country).toBe('Indonesia');
    expect(result?.admin1).toBe('Bali');
    expect(result?.city).toBe('Denpasar');
  });

  it('mengembalikan null tanpa error untuk koordinat di laut lepas (Point Nemo / Samudra Hindia)', () => {
    // Samudra Hindia tengah laut: -20.0, 85.0
    const result = service.resolve(-20.0, 85.0);
    expect(result).toBeNull();
  });

  it('mengembalikan null tanpa error untuk koordinat 0,0 (Teluk Guinea)', () => {
    const result = service.resolve(0, 0);
    expect(result).toBeNull();
  });

  it('mengembalikan null tanpa error untuk koordinat tidak valid (NaN / undefined)', () => {
    expect(service.resolve(NaN, NaN)).toBeNull();
    expect(service.resolve(undefined as any, undefined as any)).toBeNull();
  });

  it('alokasi memori dataset terukur jauh di bawah batas anggaran 150 MB', () => {
    const beforeMem = process.memoryUsage().heapUsed;
    // Pemicu pemuatan dataset lazy
    service.resolve(-6.2, 106.8);
    const afterMem = process.memoryUsage().heapUsed;
    const addedMb = (afterMem - beforeMem) / (1024 * 1024);

    // Kriteria RF-16: tambahan RAM terukur <= 150 MB
    expect(addedMb).toBeLessThan(150);
  });
});
