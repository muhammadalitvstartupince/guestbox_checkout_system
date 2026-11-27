-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "success_redirect_url" TEXT,
ADD COLUMN     "webhook_url" TEXT;
