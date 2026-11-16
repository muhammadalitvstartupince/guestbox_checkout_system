-- CreateEnum
CREATE TYPE "chat_layout" AS ENUM ('floating', 'side');
CREATE TYPE "chat_conversation_status" AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE "chat_outcome" AS ENUM ('order_completed', 'abandoned_with_info', 'abandoned_no_info', 'questions_only');
CREATE TYPE "chat_message_role" AS ENUM ('user', 'assistant', 'system');

-- AlterTable
ALTER TABLE "checkout_pages" ADD COLUMN "chat_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "checkout_pages" ADD COLUMN "chat_layout" "chat_layout" NOT NULL DEFAULT 'floating';

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "checkout_page_id" UUID NOT NULL,
    "order_id" UUID,
    "session_id" TEXT NOT NULL,
    "status" "chat_conversation_status" NOT NULL DEFAULT 'active',
    "outcome" "chat_outcome",
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "collected_data" JSONB,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abandoned_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "role" "chat_message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_checkout_page_id_fkey" FOREIGN KEY ("checkout_page_id") REFERENCES "checkout_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
