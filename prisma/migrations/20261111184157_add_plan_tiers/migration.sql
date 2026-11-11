-- AlterTable
ALTER TABLE "checkout_pages" ADD COLUMN     "tiered_plans_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "selected_plan_tier_id" UUID;

-- CreateTable
CREATE TABLE "plan_tiers" (
    "id" UUID NOT NULL,
    "checkout_page_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "annual_discount_percent" INTEGER NOT NULL DEFAULT 0,
    "zoho_monthly_item_id" TEXT,
    "zoho_annual_item_id" TEXT,
    "charge_at_checkout" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_tier_prices" (
    "id" UUID NOT NULL,
    "plan_tier_id" UUID NOT NULL,
    "min_qty" INTEGER NOT NULL,
    "max_qty" INTEGER,
    "monthly_price_cents" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_tier_prices_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "plan_tiers" ADD CONSTRAINT "plan_tiers_checkout_page_id_fkey" FOREIGN KEY ("checkout_page_id") REFERENCES "checkout_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_tier_prices" ADD CONSTRAINT "plan_tier_prices_plan_tier_id_fkey" FOREIGN KEY ("plan_tier_id") REFERENCES "plan_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_selected_plan_tier_id_fkey" FOREIGN KEY ("selected_plan_tier_id") REFERENCES "plan_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
