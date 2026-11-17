-- AlterTable
ALTER TABLE "chat_conversations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chat_messages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chatbot_settings" ADD COLUMN     "chat_model" TEXT,
ADD COLUMN     "summarizer_model" TEXT,
ALTER COLUMN "id" DROP DEFAULT;
