/**
 * Order pricing engine.
 *
 * Mirrors the legacy PHP calc (base price * qty + addon line items +
 * flat-fee addons - promo discount), generalized so addons come from the
 * checkout_addons table instead of a hardcoded price map, and promo
 * discounts come from the promo_codes table.
 *
 * All amounts are integer cents to avoid the float rounding the legacy
 * code was exposed to.
 */

export interface AddonSelection {
  /** price of this addon, in cents */
  priceCents: number;
}

export interface PromoDiscount {
  type: "percent" | "fixed";
  /** percent: 1-100. fixed: cents. */
  value: number;
}

export interface PriceCalculationInput {
  /** unit price of the core product, in cents */
  basePriceCents: number;
  quantity: number;
  addons?: AddonSelection[];
  promo?: PromoDiscount | null;
  /** recurring unit price, in cents, if this checkout has a subscription component */
  recurringPriceCents?: number | null;
}

export interface PriceCalculationResult {
  /** base*qty + addons, before any discount */
  subtotalCents: number;
  discountCents: number;
  /** subtotal - discount, floored at 0 */
  totalCents: number;
  /** recurringPriceCents * quantity. Promo discounts are never applied to
   *  the recurring amount, matching legacy behavior. 0 when there is no
   *  recurring component. */
  recurringTotalCents: number;
}

export function calculateOrderPrice(
  input: PriceCalculationInput,
): PriceCalculationResult {
  const { basePriceCents, quantity, addons = [], promo, recurringPriceCents } = input;

  if (!Number.isInteger(basePriceCents) || basePriceCents < 0) {
    throw new Error("basePriceCents must be a non-negative integer");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("quantity must be a positive integer");
  }
  for (const addon of addons) {
    if (!Number.isInteger(addon.priceCents) || addon.priceCents < 0) {
      throw new Error("addon priceCents must be a non-negative integer");
    }
  }
  if (
    recurringPriceCents != null &&
    (!Number.isInteger(recurringPriceCents) || recurringPriceCents < 0)
  ) {
    throw new Error("recurringPriceCents must be a non-negative integer");
  }

  const addonsTotalCents = addons.reduce((sum, a) => sum + a.priceCents, 0);
  const subtotalCents = basePriceCents * quantity + addonsTotalCents;

  const discountCents = clampDiscount(subtotalCents, computeDiscount(subtotalCents, promo));
  const totalCents = subtotalCents - discountCents;

  const recurringTotalCents = recurringPriceCents != null ? recurringPriceCents * quantity : 0;

  return { subtotalCents, discountCents, totalCents, recurringTotalCents };
}

function computeDiscount(subtotalCents: number, promo?: PromoDiscount | null): number {
  if (!promo) return 0;

  if (promo.type === "fixed") {
    if (!Number.isInteger(promo.value) || promo.value < 0) {
      throw new Error("fixed promo value must be a non-negative integer (cents)");
    }
    return promo.value;
  }

  if (promo.type === "percent") {
    if (promo.value < 0 || promo.value > 100) {
      throw new Error("percent promo value must be between 0 and 100");
    }
    return Math.round((subtotalCents * promo.value) / 100);
  }

  throw new Error(`Unknown promo discount type: ${(promo as PromoDiscount).type}`);
}

function clampDiscount(subtotalCents: number, discountCents: number): number {
  return Math.min(Math.max(discountCents, 0), subtotalCents);
}
