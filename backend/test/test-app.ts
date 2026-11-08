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
import { registerFastifyErrorHandler, setupApp } from '../src/setup';

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
    let ok = true;
    if ('in' in ops) ok = ok && (ops.in as unknown[]).includes(actual);
    if ('lt' in ops) ok = ok && compareValues(actual, ops.lt) < 0;
    if ('lte' in ops) ok = ok && compareValues(actual, ops.lte) <= 0;
    if ('gt' in ops) ok = ok && compareValues(actual, ops.gt) > 0;
    if ('gte' in ops) ok = ok && compareValues(actual, ops.gte) >= 0;
    if ('equals' in ops) ok = ok && actual === ops.equals;
    if ('contains' in ops) {
      if (typeof actual !== 'string' || typeof ops.contains !== 'string') {
        return false;
      }
      // contains Prisma literal: wildcard % dan _ dari input TIDAK
      // berperilaku sebagai wildcard (diuji di admin.e2e-spec).
      if (ops.mode === 'insensitive') {
        ok = ok && actual.toLowerCase().includes(ops.contains.toLowerCase());
      } else {
        ok = ok && actual.includes(ops.contains);
      }
    }
    if ('not' in ops) {
      const nested = ops.not;
      if (
        typeof nested === 'object' &&
        nested !== null &&
        !(nested instanceof Date) &&
        !Array.isArray(nested)
      ) {
        ok = ok && !matchField(actual, nested);
      } else {
        ok = ok && actual !== nested;
      }
    }
    return ok;
  }
  if (filter === null) {
    return actual === null || actual === undefined;
  }
  return actual === filter;
}

function matchWhere(
  row: Record<string, unknown>,
  where: Record<string, unknown>,
  db?: FakeDb,
): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND' && Array.isArray(value)) {
      return (value as Record<string, unknown>[]).every((w) =>
        matchWhere(row, w, db),
      );
    }
    if (key === 'OR' && Array.isArray(value)) {
      return (value as Record<string, unknown>[]).some((w) =>
        matchWhere(row, w, db),
      );
    }
    if (key === 'NOT') {
      const clauses = (
        Array.isArray(value) ? value : [value]
      ) as Record<string, unknown>[];
      return !clauses.some((w) => matchWhere(row, w, db));
    }
    if (key === 'albumFiles' && typeof value === 'object' && value !== null && db) {
      const hasAlbum = [...db.albumFiles.values()].some(
        (af) => af.fileId === row.id,
      );
      if ('none' in (value as Record<string, unknown>)) return !hasAlbum;
      if ('some' in (value as Record<string, unknown>)) return hasAlbum;
    }
    const rowVal =
      key === 'capturedAt' && row[key] === undefined
        ? (row.createdAt ?? new Date())
        : row[key];
    return matchField(rowVal, value);
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
          if (matchWhere(row, where, db)) return { ...row };
        }
        return null;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        for (const row of store.values()) {
          if (matchWhere(row, where ?? {}, db)) return { ...row };
        }
        return null;
      },
      findMany: async (args?: {
        where?: Record<string, unknown>;
        orderBy?: Record<string, string> | Array<Record<string, string>>;
        cursor?: Record<string, unknown>;
        skip?: number;
        take?: number;
      }) => {
        let rows = [...store.values()].filter((row) =>
          matchWhere(row, args?.where ?? {}, db),
        );
        const rules = args?.orderBy
          ? Array.isArray(args.orderBy)
            ? args.orderBy
            : [args.orderBy]
          : [];
        for (const rule of rules.reverse()) {
          const [field, arah] = Object.entries(rule)[0];
          rows = [...rows].sort((a, b) => {
            const valA =
              field === 'capturedAt' && a[field] === undefined
                ? (a.createdAt ?? new Date())
                : a[field];
            const valB =
              field === 'capturedAt' && b[field] === undefined
                ? (b.createdAt ?? new Date())
                : b[field];
            return (
              (arah === 'desc' ? -1 : 1) * compareValues(valA, valB)
            );
          });
        }
        if (args?.cursor) {
          const posisi = rows.findIndex((row) =>
            matchWhere(row, args.cursor as Record<string, unknown>),
          );
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
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id =
          typeof data.id === 'string' ? data.id : `x-${store.size + 1}`;
        const capturedAt = data.capturedAt ?? data.createdAt ?? new Date();
        const row = { createdAt: new Date(), capturedAt, ...data, id };
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
            const appliedData: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(data)) {
              if (v && typeof v === 'object' && 'increment' in v) {
                appliedData[k] =
                  (Number(row[k]) || 0) +
                  Number((v as { increment: number }).increment);
              } else {
                appliedData[k] = v;
              }
            }
            const next = { ...row, ...appliedData };
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
    file: (() => {
      const base = makeModel(db.files);
      return {
        ...base,
        delete: async ({ where }: { where: Record<string, unknown> }) => {
          for (const [id, row] of db.files) {
            if (matchWhere(row, where)) {
              for (const album of db.albums.values()) {
                if (album.coverFileId === id) {
                  const err = new Error(
                    'Foreign key constraint failed on the field: `cover_file_id`',
                  );
                  Object.assign(err, { code: 'P2003' });
                  throw err;
                }
              }
            }
          }
          return base.delete({ where });
        },
        deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
          for (const [id, row] of db.files) {
            if (matchWhere(row, where)) {
              for (const album of db.albums.values()) {
                if (album.coverFileId === id) {
                  const err = new Error(
                    'Foreign key constraint failed on the field: `cover_file_id`',
                  );
                  Object.assign(err, { code: 'P2003' });
                  throw err;
                }
              }
            }
          }
          return base.deleteMany({ where });
        },
        // Agregat kuota per user (US-18): sum sizeBytes
      aggregate: async (args: {
        where?: Record<string, unknown>;
        _sum?: { sizeBytes?: boolean };
      }) => {
        let total = 0n;
        for (const row of db.files.values()) {
          if (!matchWhere(row, args.where ?? {})) {
            continue;
          }
          const ukuran =
            typeof row.sizeBytes === 'bigint'
              ? row.sizeBytes
              : BigInt(Number(row.sizeBytes ?? 0));
          total += ukuran;
        }
        return {
          _sum: { sizeBytes: total },
        };
      },
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
    };
  })(),
    album: (() => {
      function attachAlbumIncludes(
        row: Record<string, unknown>,
        include?: Record<string, unknown>,
      ) {
        if (!include) return row;
        if (include.coverFile) {
          row.coverFile = row.coverFileId
            ? db.files.get(row.coverFileId as string) ?? null
            : null;
        }
        if (include.albumFiles) {
          const afs = [...db.albumFiles.values()]
            .filter((af) => af.albumId === row.id)
            .sort((a, b) => compareValues(a.position, b.position))
            .map((af) => {
              const f = db.files.get(af.fileId as string);
              return {
                ...af,
                file: f ? { ...f } : null,
              };
            });
          row.albumFiles = afs;
        }
        if (include.children) {
          const children = [...db.albums.values()]
            .filter((a) => a.parentId === row.id)
            .sort((a, b) => compareValues(b.createdAt, a.createdAt))
            .map((a) => {
              const childInc = typeof include.children === 'object' ? (include.children as Record<string, unknown>).include : undefined;
              return attachAlbumIncludes({ ...a }, childInc as Record<string, unknown>);
            });
          row.children = children;
        }
        if (include.parent) {
          row.parent = row.parentId ? (db.albums.get(row.parentId as string) ?? null) : null;
        }
        return row;
      }

      return {
        ...makeModel(db.albums),
        findUnique: async ({
          where,
          include,
        }: {
          where: Record<string, unknown>;
          include?: Record<string, unknown>;
        }) => {
          let found: Record<string, unknown> | null = null;
          for (const row of db.albums.values()) {
            if (matchWhere(row, where)) {
              found = { ...row };
              break;
            }
          }
          if (!found) return null;
          return attachAlbumIncludes(found, include);
        },
        findMany: async (args?: {
          where?: Record<string, unknown>;
          orderBy?: Record<string, string> | Array<Record<string, string>>;
          include?: Record<string, unknown>;
        }) => {
          let rows = [...db.albums.values()].filter((row) =>
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
                (arah === 'desc' ? -1 : 1) * compareValues(a[field], b[field]),
            );
          }
          return rows.map((row) => attachAlbumIncludes({ ...row }, args?.include));
        },
        update: async ({
          where,
          data,
          include,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
          include?: Record<string, unknown>;
        }) => {
          for (const [id, row] of db.albums) {
            if (matchWhere(row, where)) {
              const next = { ...row, ...data };
              db.albums.set(id, next);
              return attachAlbumIncludes({ ...next }, include);
            }
          }
          throw recordNotFound();
        },
        delete: async ({ where }: { where: Record<string, unknown> }) => {
          for (const [id, row] of db.albums) {
            if (matchWhere(row, where)) {
              db.albums.delete(id);
              for (const [afId, af] of db.albumFiles) {
                if (af.albumId === id) {
                  db.albumFiles.delete(afId);
                }
              }
              return { ...row };
            }
          }
          throw Object.assign(new Error('Record not found'), { code: 'P2025' });
        },
      };
    })(),
    albumFile: {
      ...makeModel(db.albumFiles),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = `${data.albumId}_${data.fileId}`;
        const row = { ...data, id };
        db.albumFiles.set(id, row);
        return { ...row };
      },
    },
    shareLink: {
      ...makeModel(db.shareLinks),
      findUnique: async ({
        where,
        include,
      }: {
        where: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) => {
        let found: Record<string, unknown> | null = null;
        for (const row of db.shareLinks.values()) {
          if (matchWhere(row, where)) {
            found = { ...row };
            break;
          }
        }
        if (!found) return null;
        if (include?.owner && found.ownerId) {
          const owner = db.users.get(found.ownerId as string);
          found.owner = owner ? { ...owner } : null;
        }
        return found;
      },
    },
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
  registerFastifyErrorHandler(app);
  await app.getHttpAdapter().getInstance().ready();
  return { app, db, turnstile, mail };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
