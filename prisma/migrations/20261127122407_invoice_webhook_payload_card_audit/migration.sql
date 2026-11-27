-- AlterTable
ALTER TABLE "card_access_audit_log" ADD COLUMN     "invoice_id" UUID,
ALTER COLUMN "order_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "webhook_payload" JSONB,
ADD COLUMN     "webhook_response" JSONB;

-- AddForeignKey
ALTER TABLE "card_access_audit_log" ADD CONSTRAINT "card_access_audit_log_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
