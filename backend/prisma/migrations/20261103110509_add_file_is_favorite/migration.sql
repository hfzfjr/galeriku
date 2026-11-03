-- AlterTable
ALTER TABLE "files" ADD COLUMN     "is_favorite" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "files_owner_id_is_favorite_idx" ON "files"("owner_id", "is_favorite");
