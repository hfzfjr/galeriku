import request from 'supertest';
import type { TestApp } from './test-app';

// Helper pola A-vs-B (US-13): kepemilikan menjawab 404, BUKAN 403, agar
// keberadaan data milik orang lain tidak bocor.
// Setiap story resource (files/albums/shares, Sprint 3-5) WAJIB memanggil
// helper ini dari spek e2e-nya: sediakan dua sesi (A pemilik, B bukan),
// pembuat resource sebagai A, dan pembangun request milik resource itu.
// Lihat ownership.e2e-spec.ts untuk contoh pakai yang hidup.

export type OwnershipMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

export type OwnershipRequest = {
  method: OwnershipMethod;
  url: string;
  body?: Record<string, unknown>;
};

export type OwnershipCheck = {
  cookieA: string;
  cookieB: string;
  origin?: string;
  // Buat SATU resource segar sebagai A, kembalikan id-nya. Dipanggil
  // ulang untuk setiap request sehingga mutasi (mis. DELETE) aman.
  createResource: () => Promise<string>;
  // Bangun daftar request milik resource ber-id itu (URL sudah jadi).
  buildRequests: (id: string) => OwnershipRequest[];
};

const ID_HILANG = 'id-tidak-ada-xyz';

export async function expectOwnerOnly(
  server: TestApp['app'],
  check: OwnershipCheck,
): Promise<void> {
  const http = () => request(server.getHttpAdapter().getInstance().server);
  const kirim = (r: OwnershipRequest, cookie: string | undefined) => {
    let req = http()[r.method](r.url);
    if (cookie !== undefined) {
      req = req.set('Cookie', `galeriku_session=${cookie}`);
    }
    if (r.method !== 'get' && check.origin !== undefined) {
      req = req.set('Origin', check.origin);
    }
    if (r.body !== undefined) {
      req = req.send(r.body);
    }
    return req;
  };

  const pola = check.buildRequests('id-contoh');
  if (pola.length === 0) {
    throw new Error('ownership: buildRequests kosong');
  }
  // Tanpa sesi -> 401 (default-deny) pada request pertama.
  await kirim(pola[0], undefined).expect(401);

  for (let i = 0; i < pola.length; i += 1) {
    const id = await check.createResource();
    const milik = check.buildRequests(id)[i];
    const hilang = check.buildRequests(ID_HILANG)[i];
    // B memperoleh 404 ...
    const resB = await kirim(milik, check.cookieB).expect(404);
    // ... yang IDENTIK dengan 404 id yang tidak ada ...
    const resHilang = await kirim(hilang, check.cookieB).expect(404);
    if (JSON.stringify(resB.body) !== JSON.stringify(resHilang.body)) {
      throw new Error(
        `ownership: B vs hilang tak identik pada ${milik.method} ${milik.url}: ${JSON.stringify(resB.body)} vs ${JSON.stringify(resHilang.body)}`,
      );
    }
    // ... sedangkan A berhasil (2xx).
    const resA = await kirim(milik, check.cookieA);
    if (resA.status < 200 || resA.status >= 300) {
      throw new Error(
        `ownership: A gagal pada ${milik.method} ${milik.url}: ${resA.status} ${resA.text.slice(0, 200)}`,
      );
    }
  }
}
