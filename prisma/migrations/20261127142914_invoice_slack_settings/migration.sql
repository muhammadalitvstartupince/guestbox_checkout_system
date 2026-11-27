-- CreateTable
CREATE TABLE "invoice_slack_settings" (
    "id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "slack_webhook_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_slack_settings_pkey" PRIMARY KEY ("id")
);
