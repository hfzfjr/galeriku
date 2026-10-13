import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { APP_CONFIG } from '../src/config/app-config';
import { PrismaService } from '../src/prisma/prisma.service';
import { TurnstileService } from '../src/auth/services/turnstile.service';
import { MAIL_SERVICE } from '../src/mail/mail.service';
import { setupApp } from '../src/setup';

// DB palsu dalam memori untuk e2e tanpa Postgres.
export type FakeDb = {
  users: Map<string, Record<string, unknown>>;
  sessions: Map<string, Record<string, unknown>>;
  emailCodes: Array<Record<string, unknown>>;
  files: Map<string, Record<string, unknown>>;
  albums: Map<string, Record<string, unknown>>;
  albumFiles: Map<string, Record<string, unknown>>;
  shareLinks: Map<string, Record<string, unknown>>;
  shareAccessLogs: Map<string, Record<string, unknown>>;
};

export function createFakeDb(): FakeDb {
  return {
    users: new Map(),
    sessions: new Map(),
    emailCodes: [],
    files: new Map(),
    albums: new Map(),
    albumFiles: new Map(),
    shareLinks: new Map(),
    shareAccessLogs: new Map(),
  };
}

function compareValues(a: unknown, b: unknown): number {
  const left = a instanceof Date ? a.getTime() : a;
  const right = b instanceof Date ? b.getTime() : b;
  if (left === right) return 0;
  return (left as number) < (right as number) ? -1 : 1;
}

function matchField(actual: unknown, filter: unknown): boolean {
  if (
    typeof filter === 'object' &&
    filter !== null &&
    !(filter instanceof Date) &&
    !Array.isArray(filter)
  ) {
    const ops = filter as Record<string, unknown>;
    if ('in' in ops) {
      return (ops.in as unknown[]).includes(actual);
    }
    if ('lt' in ops) return compareValues(actual, ops.lt) < 0;
    if ('lte' in ops) return compareValues(actual, ops.lte) <= 0;
    if ('gt' in ops) return compareValues(actual, ops.gt) > 0;
    if ('gte' in ops) return compareValues(actual, ops.gte) >= 0;
    if ('equals' in ops) return actual === ops.equals;
    if ('contains' in ops) {
      if (typeof actual !== 'string' || typeof ops.contains !== 'string') {
        return false;
      }
      // contains Prisma literal: wildcard % dan _ dari input TIDAK
      // berperilaku sebagai wildcard (diuji di admin.e2e-spec).
      if (ops.mode === 'insensitive') {
        return actual.toLowerCase().includes(ops.contains.toLowerCase());
      }
      return actual.includes(ops.contains);
    }
    if ('not' in ops) {
      const nested = ops.not;
      if (
        typeof nested === 'object' &&
        nested !== null &&
        !(nested instanceof Date) &&
        !Array.isArray(nested)
      ) {
        return !matchField(actual, nested);
      }
      return actual !== nested;
    }
    return false;
  }
  return actual === filter;
}

function matchWhere(
  row: Record<string, unknown>,
  where: Record<string, unknown>,
): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND' && Array.isArray(value)) {
      return (value as Record<string, unknown>[]).every((w) =>
        matchWhere(row, w),
      );
    }
    if (key === 'OR' && Array.isArray(value)) {
      return (value as Record<string, unknown>[]).some((w) =>
        matchWhere(row, w),
      );
    }
    if (key === 'NOT') {
      const clauses = (
        Array.isArray(value) ? value : [value]
      ) as Record<string, unknown>[];
      return !clauses.some((w) => matchWhere(row, w));
    }
    return matchField(row[key], value);
  });
}

export function createFakePrisma(db: FakeDb) {
  // Model generik untuk tabel relasi (US-12): find/create/update/
  // updateMany/delete/deleteMany + groupBy agregat sederhana.
  function recordNotFound(): Error {
    return Object.assign(new Error('Record not found'), { code: 'P2025' });
  }
  function makeModel(store: Map<string, Record<string, unknown>>) {
    return {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        for (const row of store.values()) {
          if (matchWhere(row, where)) return { ...row };
        }
        return null;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        for (const row of store.values()) {
          if (matchWhere(row, where ?? {})) return { ...row };
        }
        return null;
      },
      findMany: async (args?: { where?: Record<string, unknown> }) => {
        const out: Array<Record<string, unknown>> = [];
        for (const row of store.values()) {
          if (matchWhere(row, args?.where ?? {})) out.push({ ...row });
        }
        return out;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id =
          typeof data.id === 'string' ? data.id : `x-${store.size + 1}`;
        const row = { ...data, id };
        store.set(id, row);
        return { ...row };
      },
      update: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        for (const [id, row] of store) {
          if (matchWhere(row, where)) {
            const next = { ...row, ...data };
            store.set(id, next);
            return { ...next };
          }
        }
        throw recordNotFound();
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const [id, row] of store) {
          if (matchWhere(row, where)) {
            store.set(id, { ...row, ...data });
            count += 1;
          }
        }
        return { count };
      },
      delete: async ({ where }: { where: Record<string, unknown> }) => {
        for (const [id, row] of store) {
          if (matchWhere(row, where)) {
            store.delete(id);
            return { ...row };
          }
        }
        throw recordNotFound();
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        let count = 0;
        for (const [id, row] of store) {
          if (matchWhere(row, where)) {
            store.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    };
  }

  const prisma = {
    $queryRaw: async () => [{ '?column?': 1 }],
    // Transaksi array: SQLite-Serializable tidak tersedia di mock;
    // janji sudah terbentuk, jadi Promise.all setara untuk uji.
    $transaction: async (ops: unknown) =>
      Array.isArray(ops)
        ? Promise.all(ops as Array<Promise<unknown>>)
        : (ops as (tx: unknown) => Promise<unknown>)(prisma),
    user: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        for (const row of db.users.values()) {
          if (matchWhere(row, where)) return { ...row };
        }
        return null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = `u-${db.users.size + 1}`;
        const row = {
          name: null,
          avatarUrl: null,
          googleSub: null,
          emailVerifiedAt: null,
          lastLoginAt: null,
          createdAt: new Date(),
          ...data,
          id,
        };
        db.users.set(id, row);
        return { ...row };
      },
      update: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        for (const [id, row] of db.users) {
          if (matchWhere(row, where)) {
            const next = { ...row, ...data };
            db.users.set(id, next);
            return { ...next };
          }
        }
        throw Object.assign(new Error('Record not found'), {
          code: 'P2025',
        });
      },
      findMany: async (args?: {
        where?: Record<string, unknown>;
        orderBy?: Record<string, string> | Array<Record<string, string>>;
        cursor?: Record<string, unknown>;
        skip?: number;
        take?: number;
      }) => {
        let rows = [...db.users.values()].filter((row) =>
          matchWhere(row, args?.where ?? {}),
        );
        const rules = args?.orderBy
          ? Array.isArray(args.orderBy)
            ? args.orderBy
            : [args.orderBy]
          : [];
        for (const rule of rules.reverse()) {
          const [field, arah] = Object.entries(rule)[0];
          rows = [...rows].sort(
            (a, b) =>
              (arah === 'desc' ? -1 : 1) *
              compareValues(a[field], b[field]),
          );
        }
        if (args?.cursor) {
          // Seperti Prisma: baris cursor TERMASUK, lalu skip menyingkirkannya.
          const posisi = rows.findIndex((row) => matchWhere(row, args.cursor as Record<string, unknown>));
          rows = posisi >= 0 ? rows.slice(posisi) : [];
        }
        if (args?.skip) {
          rows = rows.slice(args.skip);
        }
        if (args?.take !== undefined) {
          rows = rows.slice(0, args.take);
        }
        return rows.map((row) => ({ ...row }));
      },
      delete: async ({ where }: { where: Record<string, unknown> }) => {
        for (const [id, row] of db.users) {
          if (matchWhere(row, where)) {
            db.users.delete(id);
            return { ...row };
          }
        }
        throw Object.assign(new Error('Record not found'), {
          code: 'P2025',
        });
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        let count = 0;
        for (const [id, row] of db.users) {
          if (matchWhere(row, where)) {
            db.users.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { createdAt: new Date(), ...data };
        db.sessions.set(data.id as string, row);
        return { ...row };
      },
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const row = db.sessions.get(where.id as string);
        return row ? { ...row } : null;
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        let count = 0;
        for (const [id, row] of db.sessions) {
          if (matchWhere(row, where)) {
            db.sessions.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
    emailCode: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `c-${db.emailCodes.length + 1}`, ...data };
        db.emailCodes.push(row);
        return { ...row };
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = db.emailCodes.find((r) => matchWhere(r, where));
        return row ? { ...row } : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const index = db.emailCodes.findIndex((r) => matchWhere(r, where));
        if (index < 0) {
          throw Object.assign(new Error('Record not found'), {
            code: 'P2025',
          });
        }
        const current = db.emailCodes[index] as Record<string, unknown>;
        const next = { ...current, ...data };
        db.emailCodes[index] = next;
        return { ...next };
      },
      delete: async ({ where }: { where: Record<string, unknown> }) => {
        const index = db.emailCodes.findIndex((r) => matchWhere(r, where));
        if (index < 0) {
          throw Object.assign(new Error('Record not found'), {
            code: 'P2025',
          });
        }
        const [row] = db.emailCodes.splice(index, 1);
        return row;
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const before = db.emailCodes.length;
        db.emailCodes = db.emailCodes.filter((row) => !matchWhere(row, where));
        return { count: before - db.emailCodes.length };
      },
    },
    file: {
      ...makeModel(db.files),
      // Agregat pemakaian (US-12): groupBy ownerId + sum sizeBytes.
      groupBy: async (args: {
        by: string[];
        where?: Record<string, unknown>;
        _sum?: { sizeBytes?: boolean };
      }) => {
        const jumlah = new Map<string, bigint>();
        for (const row of db.files.values()) {
          if (!matchWhere(row, args.where ?? {})) {
            continue;
          }
          const kunci = args.by.map((k) => String(row[k])).join('|');
          const ukuran =
            typeof row.sizeBytes === 'bigint'
              ? row.sizeBytes
              : BigInt(Number(row.sizeBytes ?? 0));
          jumlah.set(kunci, (jumlah.get(kunci) ?? 0n) + ukuran);
        }
        return [...jumlah.entries()].map(([pemilik, total]) => ({
          ownerId: pemilik,
          _sum: { sizeBytes: total },
        }));
      },
    },
    album: makeModel(db.albums),
    albumFile: makeModel(db.albumFiles),
    shareLink: makeModel(db.shareLinks),
    shareAccessLog: makeModel(db.shareAccessLogs),
  };
  return prisma;
}

// Stub Turnstile tanpa global jest (tak tersedia di modul ESM): antrean
// penolakan sekali pakai + pencatat panggilan.
export type TestTurnstile = {
  verify: (token: string, remoteIp: string) => Promise<void>;
  calls: Array<[string, string]>;
  rejectOnce: (error: unknown) => void;
};

export function createVerifyStub(): TestTurnstile {
  const calls: Array<[string, string]> = [];
  const queue: Array<unknown> = [];
  return {
    calls,
    rejectOnce: (error: unknown) => {
      queue.push(error);
    },
    verify: async (token: string, remoteIp: string) => {
      calls.push([token, remoteIp]);
      const next = queue.shift();
      if (next !== undefined) {
        throw next;
      }
    },
  };
}

export type MailOutbox = {
  sender: {
    send: (input: Record<string, unknown>) => Promise<void>;
  };
  sent: Array<Record<string, unknown>>;
};

export function createMailOutbox(): MailOutbox {
  const sent: Array<Record<string, unknown>> = [];
  return {
    sent,
    sender: {
      send: async (input: Record<string, unknown>) => {
        sent.push({ ...input });
      },
    },
  };
}

export type TestAppHooks = {
  // Dipanggil untuk SETIAP route yang didaftarkan Fastify (US-13:
  // enumerasi matriks). Dipasang sebelum app.init() sehingga tidak
  // ada route yang terlewat.
  onRoute?: (route: { method: string; url: string }) => void;
  // Controller khusus-tes (mis. route mainan untuk helper ownership).
  // Tidak ada di kode produksi; hanya dipakai spek yang mendaftarkannya.
  extraControllers?: Array<new (...args: never[]) => unknown>;
};

export async function createTestApp(
  db: FakeDb = createFakeDb(),
  turnstile: TestTurnstile = createVerifyStub(),
  mail: MailOutbox = createMailOutbox(),
  hooks: TestAppHooks = {},
) {
  // Nilai uji (tanpa rahasia asli). Dibaca AppConfigService asli saat modul
  // di-compile, sama seperti produksi.
  process.env.FRONTEND_ORIGIN ??= 'https://galeriku.hafizfajar.com';
  process.env.TURNSTILE_SECRET_KEY ??= 'kunci-uji-dummy-untuk-e2e';
  process.env.IP_HASH_SECRET ??= 'rahasia-ip-hash-minimal-32-karakter-e2e';
  process.env.CONTACT_EMAIL ??= 'admin@contoh.id';
  process.env.DEFAULT_QUOTA_BYTES ??= '123456789';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [...(hooks.extraControllers ?? [])],
  })
    .overrideProvider(PrismaService)
    .useValue(createFakePrisma(db))
    .overrideProvider(TurnstileService)
    .useValue({ verify: turnstile.verify.bind(turnstile) })
    .overrideProvider(MAIL_SERVICE)
    .useValue(mail.sender)
    .compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  if (hooks.onRoute) {
    const catat = hooks.onRoute;
    app.getHttpAdapter().getInstance().addHook('onRoute', (route) => {
      const methods = Array.isArray(route.method)
        ? route.method
        : [route.method];
      for (const method of methods) {
        catat({ method: String(method).toUpperCase(), url: route.url });
      }
    });
  }
  // Fungsi konfigurasi yang SAMA dengan main.ts.
  await setupApp(app, moduleFixture.get(APP_CONFIG));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, db, turnstile, mail };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
