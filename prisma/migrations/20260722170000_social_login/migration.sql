-- AlterEnum
ALTER TYPE "IdentityProvider" ADD VALUE 'GOOGLE';
ALTER TYPE "IdentityProvider" ADD VALUE 'FACEBOOK';
ALTER TYPE "IdentityProvider" ADD VALUE 'APPLE';
ALTER TYPE "IdentityProvider" ADD VALUE 'MICROSOFT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;
