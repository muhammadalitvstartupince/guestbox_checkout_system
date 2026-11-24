-- AlterTable
ALTER TABLE "orders" ADD COLUMN "tax_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "address_verified" BOOLEAN NOT NULL DEFAULT false;
