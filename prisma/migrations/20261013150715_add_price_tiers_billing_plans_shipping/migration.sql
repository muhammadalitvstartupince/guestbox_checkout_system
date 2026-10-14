-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "selected_billing_plan_id" UUID,
ADD COLUMN     "shipping_address_line1" TEXT,
ADD COLUMN     "shipping_city" TEXT,
ADD COLUMN     "shipping_country" TEXT,
ADD COLUMN     "shipping_same_as_billing" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shipping_state" TEXT,
ADD COLUMN     "shipping_zip" TEXT;

-- CreateTable
CREATE TABLE "price_tiers" (
    "id" UUID NOT NULL,
    "checkout_page_id" UUID NOT NULL,
    "min_qty" INTEGER NOT NULL,
    "max_qty" INTEGER,
    "price_cents" INTEGER NOT NULL,
    "zoho_item_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_plans" (
    "id" UUID NOT NULL,
    "checkout_page_id" UUID NOT NULL,
    "interval" "billing_interval" NOT NULL,
    "label" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "zoho_item_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_checkout_page_id_fkey" FOREIGN KEY ("checkout_page_id") REFERENCES "checkout_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_plans" ADD CONSTRAINT "billing_plans_checkout_page_id_fkey" FOREIGN KEY ("checkout_page_id") REFERENCES "checkout_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
