-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "discount_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_label" TEXT,
ADD COLUMN     "shipping_address_line1" TEXT,
ADD COLUMN     "shipping_city" TEXT,
ADD COLUMN     "shipping_country" TEXT,
ADD COLUMN     "shipping_same_as_billing" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shipping_state" TEXT,
ADD COLUMN     "shipping_zip" TEXT;
