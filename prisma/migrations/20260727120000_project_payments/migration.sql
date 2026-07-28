-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "billing_account_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payer_name" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payer_email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payments_stripe_checkout_session_id_key" ON "payments"("stripe_checkout_session_id");
CREATE INDEX IF NOT EXISTS "payments_status_paid_at_idx" ON "payments"("status", "paid_at");
CREATE INDEX IF NOT EXISTS "payments_created_at_idx" ON "payments"("created_at");
