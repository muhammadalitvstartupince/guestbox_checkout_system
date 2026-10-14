-- CreateTable
CREATE TABLE "email_settings" (
    "id" UUID NOT NULL,
    "sendgrid_api_key" TEXT,
    "email_from" TEXT NOT NULL,
    "internal_notify_emails" TEXT[],
    "customer_confirmation_subject" TEXT NOT NULL,
    "customer_confirmation_html" TEXT NOT NULL,
    "internal_notify_subject" TEXT NOT NULL,
    "internal_notify_html" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);
