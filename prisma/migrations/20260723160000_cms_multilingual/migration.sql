-- CreateEnum
CREATE TYPE "CmsArticleStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "NotificationEventType" ADD VALUE 'CMS_PUBLISHED';

-- CreateTable
CREATE TABLE "cms_folders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_articles" (
    "id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CmsArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "seo_meta" JSONB,
    "ai_meta" JSONB,
    "workflow_state" TEXT,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_translations" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_versions" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_folders_code_key" ON "cms_folders"("code");

-- CreateIndex
CREATE INDEX "cms_folders_parent_id_sort_order_idx" ON "cms_folders"("parent_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "cms_articles_slug_key" ON "cms_articles"("slug");

-- CreateIndex
CREATE INDEX "cms_articles_folder_id_status_idx" ON "cms_articles"("folder_id", "status");

-- CreateIndex
CREATE INDEX "cms_articles_status_updated_at_idx" ON "cms_articles"("status", "updated_at");

-- CreateIndex
CREATE INDEX "cms_translations_locale_idx" ON "cms_translations"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "cms_translations_article_id_locale_key" ON "cms_translations"("article_id", "locale");

-- CreateIndex
CREATE INDEX "cms_versions_article_id_created_at_idx" ON "cms_versions"("article_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cms_versions_article_id_version_key" ON "cms_versions"("article_id", "version");

-- AddForeignKey
ALTER TABLE "cms_folders" ADD CONSTRAINT "cms_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "cms_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_articles" ADD CONSTRAINT "cms_articles_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "cms_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_translations" ADD CONSTRAINT "cms_translations_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "cms_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_versions" ADD CONSTRAINT "cms_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "cms_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
