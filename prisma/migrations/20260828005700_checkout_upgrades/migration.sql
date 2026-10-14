-- AlterTable
ALTER TABLE "checkout_pages" ADD COLUMN     "upgrade_description" TEXT,
ADD COLUMN     "upgrade_price_cents" INTEGER,
ADD COLUMN     "upgrade_recurring_price_cents" INTEGER,
ADD COLUMN     "upgrade_title" TEXT,
ADD COLUMN     "upgrade_zoho_item_id" TEXT,
ADD COLUMN     "upgrade_zoho_recurring_item_id" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "upgrade_selected" BOOLEAN NOT NULL DEFAULT false;
