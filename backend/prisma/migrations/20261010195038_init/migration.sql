-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('uploading', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "ShareTarget" AS ENUM ('file', 'album');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "password_hash" TEXT,
    "google_sub" TEXT,
    "role" "Role" NOT NULL,
    "quota_bytes" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_emails" (
    "email" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "invite_token_hash" TEXT,
    "invite_expires_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowed_emails_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "kind" "FileKind" NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_s" DOUBLE PRECISION,
    "thumb_key" TEXT,
    "status" "FileStatus" NOT NULL,
    "taken_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cover_file_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_files" (
    "album_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "album_files_pkey" PRIMARY KEY ("album_id","file_id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "target_type" "ShareTarget" NOT NULL,
    "target_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "password_hash" TEXT,
    "allow_download" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_access_logs" (
    "id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT NOT NULL,
    "user_agent" TEXT,

    CONSTRAINT "share_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "files_owner_id_created_at_idx" ON "files"("owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "album_files_album_id_position_idx" ON "album_files"("album_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_files" ADD CONSTRAINT "album_files_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_files" ADD CONSTRAINT "album_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_access_logs" ADD CONSTRAINT "share_access_logs_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
