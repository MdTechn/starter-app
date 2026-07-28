-- DropIndex
DROP INDEX "payments_status_idx";

-- CreateTable
CREATE TABLE "brand_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "app_name" TEXT,
    "company_name" TEXT,
    "app_url" TEXT,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "theme" TEXT,
    "font_family" TEXT,
    "icon_url" TEXT,
    "apple_touch_icon_url" TEXT,
    "support_email" TEXT,
    "support_url" TEXT,
    "meta_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_settings_pkey" PRIMARY KEY ("id")
);
