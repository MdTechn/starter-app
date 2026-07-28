-- AlterTable
ALTER TABLE "cms_folders" ADD COLUMN "organization_id" TEXT;

-- AlterTable
ALTER TABLE "cms_articles" ADD COLUMN "organization_id" TEXT;

-- CreateIndex
CREATE INDEX "cms_folders_organization_id_idx" ON "cms_folders"("organization_id");

-- CreateIndex
CREATE INDEX "cms_articles_organization_id_status_idx" ON "cms_articles"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "cms_folders" ADD CONSTRAINT "cms_folders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_articles" ADD CONSTRAINT "cms_articles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
