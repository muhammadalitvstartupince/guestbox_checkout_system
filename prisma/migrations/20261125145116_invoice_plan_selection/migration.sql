-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "selected_plan_interval" TEXT,
ADD COLUMN     "selected_plan_name" TEXT,
ADD COLUMN     "selected_plan_price_cents" INTEGER;
