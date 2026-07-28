-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('IMAGE', 'DOCUMENT', 'AVATAR');

-- CreateEnum
CREATE TYPE "StorageDriverKind" AS ENUM ('LOCAL', 'S3', 'CLOUDINARY');

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" "FileKind" NOT NULL,
    "driver" "StorageDriverKind" NOT NULL,
    "url" TEXT NOT NULL,
    "owner_type" TEXT,
    "owner_id" TEXT,
    "uploaded_by_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_key_key" ON "file_assets"("key");

-- CreateIndex
CREATE INDEX "file_assets_owner_type_owner_id_idx" ON "file_assets"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "file_assets_uploaded_by_id_created_at_idx" ON "file_assets"("uploaded_by_id", "created_at");

-- CreateIndex
CREATE INDEX "file_assets_kind_created_at_idx" ON "file_assets"("kind", "created_at");

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
