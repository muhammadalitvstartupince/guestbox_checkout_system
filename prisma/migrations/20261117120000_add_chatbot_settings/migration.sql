-- CreateTable
CREATE TABLE "chatbot_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "system_prompt" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_settings_pkey" PRIMARY KEY ("id")
);
