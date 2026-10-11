-- US-09: Role owner/member -> USER/ADMIN, status akun, email_verified_at,
-- tabel email_codes (dipakai US-09b), hapus allowed_emails, indeks sessions.

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EmailCodeKind" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- AlterEnum Role: semua baris lama (owner/member) dipetakan ke USER.
-- USING CASE agar migrasi tidak gagal bila tabel sudah berisi baris.
CREATE TYPE "Role_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'owner' THEN 'USER'::"Role_new"
    WHEN 'member' THEN 'USER'::"Role_new"
    ELSE 'USER'::"Role_new"
  END
);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';

-- AddColumn status (baris lama terisi ACTIVE dari DEFAULT)
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- AddColumn email_verified_at
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" "EmailCodeKind" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_codes_email_kind_idx" ON "email_codes"("email", "kind");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- DropTable (registrasi terbuka tidak memakai allowlist)
DROP TABLE "allowed_emails";
