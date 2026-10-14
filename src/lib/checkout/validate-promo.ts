import { prisma } from "@/lib/db/client";

export interface PromoValidationResult {
  valid: boolean;
  message: string;
  promo?: { id: string; type: "percent" | "fixed"; value: number };
}

/** Shared by the live "Validate" button (checkPromoCode) and the actual
 *  charge step (completeCheckout) — same rules, so a code that checks out
 *  live can never fail differently at payment time. */
export async function validatePromoCode(checkoutPageId: string, rawCode: string): Promise<PromoValidationResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { valid: false, message: "Enter a promo code." };
  }

  const promoRow = await prisma.promoCode.findUnique({ where: { code } });
  const now = new Date();

  if (!promoRow) {
    return { valid: false, message: "That promo code doesn't exist." };
  }
  if (!promoRow.isActive) {
    return { valid: false, message: "That promo code is no longer active." };
  }
  if (promoRow.appliesToCheckoutPageId && promoRow.appliesToCheckoutPageId !== checkoutPageId) {
    return { valid: false, message: "That promo code doesn't apply to this checkout." };
  }
  if (promoRow.startsAt && promoRow.startsAt > now) {
    return { valid: false, message: "That promo code isn't active yet." };
  }
  if (promoRow.expiresAt && promoRow.expiresAt < now) {
    return { valid: false, message: "That promo code has expired." };
  }
  if (promoRow.maxRedemptions != null && promoRow.timesRedeemed >= promoRow.maxRedemptions) {
    return { valid: false, message: "That promo code has already reached its redemption limit." };
  }

  const discountLabel =
    promoRow.discountType === "percent" ? `${promoRow.discountValue}% off` : `$${(promoRow.discountValue / 100).toFixed(2)} off`;

  return {
    valid: true,
    message: `Valid — ${discountLabel}`,
    promo: { id: promoRow.id, type: promoRow.discountType, value: promoRow.discountValue },
  };
}
