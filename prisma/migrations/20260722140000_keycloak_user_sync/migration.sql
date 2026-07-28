-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "keycloak_sub" TEXT;
ALTER TABLE "users" ADD COLUMN "roles" "Role"[] DEFAULT ARRAY['USER']::"Role"[];

-- Backfill existing rows then enforce constraints
UPDATE "users" SET "keycloak_sub" = "id" WHERE "keycloak_sub" IS NULL;

ALTER TABLE "users" ALTER COLUMN "keycloak_sub" SET NOT NULL;

CREATE UNIQUE INDEX "users_keycloak_sub_key" ON "users"("keycloak_sub");
