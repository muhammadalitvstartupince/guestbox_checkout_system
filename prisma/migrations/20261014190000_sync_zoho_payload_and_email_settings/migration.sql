-- AlterTable
ALTER TABLE "email_settings" ADD COLUMN "customer_confirmation_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "zoho_payload" JSONB;
