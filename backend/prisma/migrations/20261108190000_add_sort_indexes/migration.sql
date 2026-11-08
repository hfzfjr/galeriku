-- CreateIndex
CREATE INDEX "files_owner_id_original_name_id_idx" ON "files"("owner_id", "original_name", "id");

-- CreateIndex
CREATE INDEX "files_owner_id_size_bytes_id_idx" ON "files"("owner_id", "size_bytes", "id");

