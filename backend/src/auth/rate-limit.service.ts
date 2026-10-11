import { Injectable } from '@nestjs/common';

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

// Limiter memori kecil (sliding window) untuk batas per email pada login.
// Penyimpanan memori cukup karena satu container. Kunci kedaluwarsa
// dibersihkan malas (lazy) per kunci + sapuan penuh berkala.
@Injectable()
export class RateLimitService {
  private readonly hits = new Map<string, number[]>();

  checkAndRecord(
    key: string,
    limit: number,
    windowMs: number,
    nowMs = Date.now(),
  ): RateLimitResult {
    const cutoff = nowMs - windowMs;
    let list = this.hits.get(key);
    if (!list) {
      list = [];
      this.hits.set(key, list);
    }
    while (list.length > 0 && (list[0] as number) <= cutoff) {
      list.shift();
    }
    if (list.length >= limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil(((list[0] as number) + windowMs - nowMs) / 1000),
      );
      return { allowed: false, retryAfterSec };
    }
    list.push(nowMs);
    if (this.hits.size > 10000) {
      this.sweep(nowMs);
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  clear(): void {
    this.hits.clear();
  }

  private sweep(nowMs: number): void {
    for (const [key, list] of this.hits) {
      while (list.length > 0 && (list[0] as number) <= nowMs - 3600000) {
        list.shift();
      }
      if (list.length === 0) {
        this.hits.delete(key);
      }
    }
  }
}
