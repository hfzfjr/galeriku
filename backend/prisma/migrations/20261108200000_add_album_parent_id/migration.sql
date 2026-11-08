-- AlterTable
ALTER TABLE "albums" ADD COLUMN "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "albums_owner_id_parent_id_idx" ON "albums"("owner_id", "parent_id");

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "albums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
