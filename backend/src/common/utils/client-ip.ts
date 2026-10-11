import { createHmac } from 'node:crypto';

// Satu utilitas IP klien untuk rate limit, hash IP, dan Turnstile.
// Backend hanya dijangkau lewat tunnel di 127.0.0.1, jadi IP socket tidak
// bisa dipakai: utamakan header cf-connecting-ip dari Cloudflare.
export function getClientIp(req: unknown): string {
  const headers = (req as { headers?: unknown })?.headers as
    | Record<string, string | string[] | undefined>
    | undefined;
  const forwarded = headers?.['cf-connecting-ip'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof first === 'string') {
    const ip = first.split(',')[0].trim();
    if (ip.length > 0) {
      return ip;
    }
  }
  const socketIp = (req as { ip?: unknown })?.ip;
  if (typeof socketIp === 'string' && socketIp.length > 0) {
    return socketIp;
  }
  return 'unknown';
}

export function getUserAgent(req: unknown, maxLength = 255): string {
  const headers = (req as { headers?: unknown })?.headers as
    | Record<string, string | string[] | undefined>
    | undefined;
  const agent = headers?.['user-agent'];
  const first = Array.isArray(agent) ? agent[0] : agent;
  if (typeof first !== 'string') {
    return '';
  }
  return first.slice(0, maxLength);
}

export function hashIp(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(ip, 'utf8').digest('hex');
}
