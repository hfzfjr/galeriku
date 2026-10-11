import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  it('mengizinkan sampai batas lalu menolak dengan Retry-After', () => {
    const limiter = new RateLimitService();
    const now = 1_000_000;
    expect(limiter.checkAndRecord('k', 3, 60_000, now).allowed).toBe(true);
    expect(limiter.checkAndRecord('k', 3, 60_000, now).allowed).toBe(true);
    expect(limiter.checkAndRecord('k', 3, 60_000, now).allowed).toBe(true);
    const blocked = limiter.checkAndRecord('k', 3, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('jendela geser: hitungan lama kedaluwarsa', () => {
    const limiter = new RateLimitService();
    expect(limiter.checkAndRecord('k', 1, 1000, 0).allowed).toBe(true);
    expect(limiter.checkAndRecord('k', 1, 1000, 500).allowed).toBe(false);
    expect(limiter.checkAndRecord('k', 1, 1000, 1001).allowed).toBe(true);
  });

  it('kunci berbeda punya kuota sendiri', () => {
    const limiter = new RateLimitService();
    expect(limiter.checkAndRecord('a', 1, 60_000, 0).allowed).toBe(true);
    expect(limiter.checkAndRecord('a', 1, 60_000, 0).allowed).toBe(false);
    expect(limiter.checkAndRecord('b', 1, 60_000, 0).allowed).toBe(true);
  });

  it('clear() mengatur ulang semua kunci', () => {
    const limiter = new RateLimitService();
    expect(limiter.checkAndRecord('k', 1, 60_000, 0).allowed).toBe(true);
    expect(limiter.checkAndRecord('k', 1, 60_000, 0).allowed).toBe(false);
    limiter.clear();
    expect(limiter.checkAndRecord('k', 1, 60_000, 0).allowed).toBe(true);
  });
});
