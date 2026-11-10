-- CreateEnum
CREATE TYPE "promo_applies_to" AS ENUM ('device', 'monthly', 'annual', 'device_monthly', 'device_annual', 'monthly_annual', 'all');

-- AlterTable
ALTER TABLE "promo_codes" ADD COLUMN     "applies_to" "promo_applies_to" NOT NULL DEFAULT 'device';
