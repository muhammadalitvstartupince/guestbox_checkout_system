-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "badge_text" TEXT NOT NULL DEFAULT 'Limited Time',
ADD COLUMN     "urgency_text" TEXT NOT NULL DEFAULT 'Offer ends soon — don''t miss out!';
