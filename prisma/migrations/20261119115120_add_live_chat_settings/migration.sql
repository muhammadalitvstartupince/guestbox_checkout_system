-- CreateTable
CREATE TABLE "live_chat_settings" (
    "id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_chat_settings_pkey" PRIMARY KEY ("id")
);
