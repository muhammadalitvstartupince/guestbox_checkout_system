-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "abandoned_notified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "abandoned_checkout_settings" (
    "id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "slack_webhook_url" TEXT,
    "timeout_minutes" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abandoned_checkout_settings_pkey" PRIMARY KEY ("id")
);
