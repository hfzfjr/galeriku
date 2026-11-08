-- Perbaiki captured_at untuk file lama yang terdampak default CURRENT_TIMESTAMP saat migrasi
UPDATE "files"
SET "captured_at" = COALESCE("taken_at", "created_at"),
    "captured_at_source" = CASE
      WHEN "taken_at" IS NOT NULL THEN 'exif'::"CapturedAtSource"
      ELSE 'upload'::"CapturedAtSource"
    END
WHERE "meta_version" = 0;
