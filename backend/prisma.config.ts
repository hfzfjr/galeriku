import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

// Prisma CLI tidak memuat .env secara otomatis untuk evaluasi config ini,
// dan menambah dependency dotenv tidak diizinkan. Node 24 punya
// process.loadEnvFile() bawaan: muat backend/.env bila ada (dev lokal).
// Di container produksi file .env tidak ada: DATABASE_URL datang dari
// environment Compose, dan pemuatan ini dilewati.
const envPath = join(dirname(fileURLToPath(import.meta.url)), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
