-- AlterTable
ALTER TABLE "price_tiers" ADD COLUMN     "is_base" BOOLEAN NOT NULL DEFAULT false;

-- Auto-mark the highest-priced tier per checkout page as base
UPDATE "price_tiers" SET "is_base" = true
WHERE id IN (
  SELECT DISTINCT ON (checkout_page_id) id
  FROM "price_tiers"
  ORDER BY checkout_page_id, price_cents DESC, sort_order ASC
);
