import { createHash, randomBytes } from 'node:crypto';
import { hashSessionToken } from './session.service';

describe('token sesi', () => {
  it('token 32 byte base64url dan id SHA-256 hex yang berbeda', () => {
    const token = randomBytes(32).toString('base64url');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const id = hashSessionToken(token);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).not.toContain(token);
    expect(id).toBe(
      createHash('sha256').update(token, 'utf8').digest('hex'),
    );
  });
});
