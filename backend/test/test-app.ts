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
};

export function createFakeDb(): FakeDb {
  return { users: new Map(), sessions: new Map(), emailCodes: [] };
}

function compareValues(a: unknown, b: unknown): number {
  const left = a instanceof Date ? a.getTime() : a;
  const right = b instanceof Date ? b.getTime() : b;
  if (left === right) return 0;
  return (left as number) < (right as number) ? -1 : 1;
}

function matchWhere(
  row: Record<string, unknown>,
  where: Record<string, unknown>,
): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (
      typeof value === 'object' &&
      value !== null &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    ) {
      const ops = value as Record<string, unknown>;
      if ('in' in ops) {
        return (ops.in as unknown[]).includes(row[key]);
      }
      if ('lt' in ops) return compareValues(row[key], ops.lt) < 0;
      if ('lte' in ops) return compareValues(row[key], ops.lte) <= 0;
      if ('gt' in ops) return compareValues(row[key], ops.gt) > 0;
      if ('gte' in ops) return compareValues(row[key], ops.gte) >= 0;
      if ('equals' in ops) return row[key] === ops.equals;
    }
    return row[key] === value;
  });
}

export function createFakePrisma(db: FakeDb) {
  return {
    $queryRaw: async () => [{ '?column?': 1 }],
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
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const out: Array<Record<string, unknown>> = [];
        for (const row of db.users.values()) {
          if (matchWhere(row, where)) out.push({ ...row });
        }
        return out;
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
  };
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

export async function createTestApp(
  db: FakeDb = createFakeDb(),
  turnstile: TestTurnstile = createVerifyStub(),
  mail: MailOutbox = createMailOutbox(),
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
  // Fungsi konfigurasi yang SAMA dengan main.ts.
  await setupApp(app, moduleFixture.get(APP_CONFIG));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, db, turnstile, mail };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
