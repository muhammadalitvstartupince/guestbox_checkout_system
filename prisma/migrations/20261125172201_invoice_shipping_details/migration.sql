-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "shipping_carrier" TEXT,
ADD COLUMN     "shipping_est_days" INTEGER,
ADD COLUMN     "shipping_service" TEXT;
