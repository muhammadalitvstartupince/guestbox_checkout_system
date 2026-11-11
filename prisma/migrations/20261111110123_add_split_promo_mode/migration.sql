-- CreateEnum
CREATE TYPE "discount_mode" AS ENUM ('single', 'split');

-- AlterTable
ALTER TABLE "promo_codes" ADD COLUMN     "annual_discount_type" "discount_type",
ADD COLUMN     "annual_discount_value" INTEGER,
ADD COLUMN     "device_discount_type" "discount_type",
ADD COLUMN     "device_discount_value" INTEGER,
ADD COLUMN     "discount_mode" "discount_mode" NOT NULL DEFAULT 'single',
ADD COLUMN     "monthly_discount_type" "discount_type",
ADD COLUMN     "monthly_discount_value" INTEGER;
