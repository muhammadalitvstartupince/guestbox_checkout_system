-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "promo_code_id" UUID NOT NULL,
    "price_tier_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_checkout_pages" (
    "id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "checkout_page_id" UUID NOT NULL,

    CONSTRAINT "promotion_checkout_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotion_checkout_pages_promotion_id_checkout_page_id_key" ON "promotion_checkout_pages"("promotion_id", "checkout_page_id");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_price_tier_id_fkey" FOREIGN KEY ("price_tier_id") REFERENCES "price_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_checkout_pages" ADD CONSTRAINT "promotion_checkout_pages_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_checkout_pages" ADD CONSTRAINT "promotion_checkout_pages_checkout_page_id_fkey" FOREIGN KEY ("checkout_page_id") REFERENCES "checkout_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
