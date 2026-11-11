-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shipping_carrier" TEXT,
ADD COLUMN     "shipping_est_days" INTEGER,
ADD COLUMN     "shipping_rate_cents" INTEGER,
ADD COLUMN     "shipping_service" TEXT,
ADD COLUMN     "shippo_rate_id" TEXT;
