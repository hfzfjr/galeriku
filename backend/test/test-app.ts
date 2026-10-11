import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { APP_CONFIG } from '../src/app-config';
import { PrismaService } from '../src/prisma.service';
import { TurnstileService } from '../src/auth/turnstile.service';
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

function matchWhere(
  row: Record<string, unknown>,
  where: Record<string, unknown>,
): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
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

export async function createTestApp(
  db: FakeDb = createFakeDb(),
  turnstile: TestTurnstile = createVerifyStub(),
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
    .compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  // Fungsi konfigurasi yang SAMA dengan main.ts.
  await setupApp(app, moduleFixture.get(APP_CONFIG));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, db, turnstile };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
