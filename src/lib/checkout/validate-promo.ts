import { prisma } from "@/lib/db/client";

interface DiscountSlot {
  type: "percent" | "fixed";
  value: number;
}

export interface SinglePromo {
  id: string;
  mode: "single";
  type: "percent" | "fixed";
  value: number;
  appliesTo: string;
  perDevice: boolean;
}

export interface SplitPromo {
  id: string;
  mode: "split";
  device: DiscountSlot | null;
  monthly: DiscountSlot | null;
  annual: DiscountSlot | null;
  perDevice: boolean;
}

export type PromoInfo = SinglePromo | SplitPromo;

export interface PromoValidationResult {
  valid: boolean;
  message: string;
  promo?: PromoInfo;
}

function formatSlot(slot: DiscountSlot, label: string): string {
  const amt = slot.type === "percent" ? `${slot.value}%` : `$${(slot.value / 100).toFixed(2)}`;
  return `${amt} off ${label}`;
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

  // --- Split mode ---
  if (promoRow.discountMode === "split") {
    const device: DiscountSlot | null =
      promoRow.deviceDiscountType && promoRow.deviceDiscountValue != null
        ? { type: promoRow.deviceDiscountType, value: promoRow.deviceDiscountValue }
        : null;
    const monthly: DiscountSlot | null =
      promoRow.monthlyDiscountType && promoRow.monthlyDiscountValue != null
        ? { type: promoRow.monthlyDiscountType, value: promoRow.monthlyDiscountValue }
        : null;
    const annual: DiscountSlot | null =
      promoRow.annualDiscountType && promoRow.annualDiscountValue != null
        ? { type: promoRow.annualDiscountType, value: promoRow.annualDiscountValue }
        : null;

    const parts: string[] = [];
    if (device) parts.push(formatSlot(device, "devices") + (promoRow.perDevice && device.type === "fixed" ? "/each" : ""));
    if (monthly) parts.push(formatSlot(monthly, "monthly"));
    if (annual) parts.push(formatSlot(annual, "annual"));
    const discountLabel = parts.length > 0 ? parts.join(" + ") : "No discount configured";

    return {
      valid: true,
      message: `Valid — ${discountLabel}`,
      promo: { id: promoRow.id, mode: "split", device, monthly, annual, perDevice: promoRow.perDevice },
    };
  }

  // --- Single mode (existing behavior) ---
  const targetLabels: Record<string, string> = {
    device: "",
    monthly: " (monthly plan)",
    annual: " (annual plan)",
    device_monthly: " (device + monthly)",
    device_annual: " (device + annual)",
    monthly_annual: " (monthly + annual)",
    all: " (device + plan)",
  };
  const targetLabel = targetLabels[promoRow.appliesTo] ?? "";
  const perDeviceSuffix = promoRow.perDevice && promoRow.discountType === "fixed" ? " per device" : "";
  const discountLabel =
    promoRow.discountType === "percent"
      ? `${promoRow.discountValue}% off${targetLabel}`
      : `$${(promoRow.discountValue / 100).toFixed(2)} off${targetLabel}${perDeviceSuffix}`;

  return {
    valid: true,
    message: `Valid — ${discountLabel}`,
    promo: { id: promoRow.id, mode: "single", type: promoRow.discountType, value: promoRow.discountValue, appliesTo: promoRow.appliesTo, perDevice: promoRow.perDevice },
  };
}
