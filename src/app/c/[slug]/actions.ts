"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { getClientIp, getUserAgent } from "@/lib/http/client-info";
import { parseContactInfoData, parseBillingInfoData, parsePaymentData } from "@/lib/checkout/schema";
import type { CheckoutFormState, InitiateOrderState, BillingInfoState } from "@/lib/checkout/types";
import { calculateOrderPrice } from "@/lib/pricing/calculate";
import { chargeCreditCard } from "@/lib/payments/authorize-net";
import {
  detectCardBrand,
  encryptCardField,
  generateCardHashKey,
  getCardLast4,
} from "@/lib/crypto/card-crypto";
import { postZohoInvoice } from "@/lib/zoho/post-invoice";
import { buildZohoLineItems, buildZohoRecurringLineItems } from "@/lib/zoho/order-payload";
import { hasUpgradeOffer, selectEffectiveProduct } from "@/lib/checkout/select-product";
import { validatePromoCode } from "@/lib/checkout/validate-promo";
import { sendEmail } from "@/lib/email/send";
import { getEmailSettings } from "@/lib/email/settings";
import { renderEmailTemplate } from "@/lib/email/render-template";
import { sendOrderConfirmationEmail } from "@/lib/email/send-order-confirmation";
import { sendOrderWebhook } from "@/lib/webhook/send";
import { logOrderEvent } from "@/lib/orders/log-event";

/**
 * Step 1: contact info only. Creates the order immediately (status
 * "pending") so it's visible in the admin timeline even if the customer
 * never makes it through payment — this is the "order init" event.
 */
export async function initiateOrder(
  checkoutPageSlug: string,
  _prevState: InitiateOrderState,
  formData: FormData,
): Promise<InitiateOrderState> {
  const checkoutPage = await prisma.checkoutPage.findUnique({ where: { slug: checkoutPageSlug } });

  if (!checkoutPage || checkoutPage.status === "archived") {
    return { status: "error", message: "This checkout page is no longer available." };
  }

  const parsed = parseContactInfoData(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // Full URL (with query string) the customer's browser actually had loaded
  // — carried in via a hidden field set from the server component that
  // rendered this page (app/c/[slug]/page.tsx), not trusted as anything
  // more than an attribution hint.
  const landingUrl = formData.get("landingUrl")?.toString().trim() || null;

  const headersList = await headers();

  const quantity = Math.max(1, Math.min(10, Number(formData.get("quantity")) || 1));

  // Resolve unit price from tiers (if any) for the estimated amount
  let unitPriceCents = checkoutPage.basePriceCents;
  const priceTiers = await prisma.priceTier.findMany({
    where: { checkoutPageId: checkoutPage.id },
    orderBy: { sortOrder: "asc" },
  });
  if (priceTiers.length > 0) {
    const matchedTier = priceTiers.find(
      (t) => quantity >= t.minQty && (t.maxQty == null || quantity <= t.maxQty),
    );
    if (matchedTier) unitPriceCents = matchedTier.priceCents;
  }

  const order = await prisma.order.create({
    data: {
      checkoutPageId: checkoutPage.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      quantity,
      amountCents: unitPriceCents * quantity,
      landingUrl,
      userAgent: getUserAgent(headersList),
      ipAddress: getClientIp(headersList),
      cardHashKey: generateCardHashKey(),
      status: "pending",
    },
  });

  await logOrderEvent(order.id, "order_initiated", `Checkout started by ${data.firstName} ${data.lastName} (${data.email})`);

  return { status: "success", orderId: order.id };
}

/**
 * Live "Validate" check for the promo code field on the payment step —
 * lets the customer confirm a code before submitting the whole payment
 * form. Uses the exact same rules completeCheckout enforces at charge
 * time, so a code that checks out here can't fail differently there.
 */
export async function checkPromoCode(
  checkoutPageSlug: string,
  code: string,
): Promise<{ valid: boolean; message: string; discount?: { type: "percent" | "fixed"; value: number } }> {
  const checkoutPage = await prisma.checkoutPage.findUnique({
    where: { slug: checkoutPageSlug },
    include: { promotionLinks: { include: { promotion: { select: { isActive: true } } } } },
  });
  const hasActivePromotion = checkoutPage?.promotionLinks.some((l) => l.promotion.isActive) ?? false;
  if (!checkoutPage || (!checkoutPage.showPromoCode && !hasActivePromotion)) {
    return { valid: false, message: "Promo codes aren't available on this checkout." };
  }

  const result = await validatePromoCode(checkoutPage.id, code);
  return {
    valid: result.valid,
    message: result.message,
    discount: result.promo ? { type: result.promo.type, value: result.promo.value } : undefined,
  };
}

/**
 * Step 2: billing address. Updates the order created in step 1 with address
 * fields only — no charge happens yet.
 */
export async function saveBillingInfo(
  orderId: string,
  _prevState: BillingInfoState,
  formData: FormData,
): Promise<BillingInfoState> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) {
    return { status: "error", message: "We couldn't find this order. Please start over." };
  }
  if (order.status === "paid") {
    return { status: "error", message: "This order has already been paid." };
  }

  const parsed = parseBillingInfoData(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const shippingSameAsBilling = formData.get("shippingSameAsBilling") === "on";

  await prisma.order.update({
    where: { id: order.id },
    data: {
      addressLine1: data.addressLine1,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country,
      shippingSameAsBilling,
      shippingAddressLine1: shippingSameAsBilling ? data.addressLine1 : (formData.get("shippingAddressLine1")?.toString().trim() || data.addressLine1),
      shippingCity: shippingSameAsBilling ? data.city : (formData.get("shippingCity")?.toString().trim() || data.city),
      shippingState: shippingSameAsBilling ? data.state : (formData.get("shippingState")?.toString().trim() || data.state),
      shippingZip: shippingSameAsBilling ? data.zip : (formData.get("shippingZip")?.toString().trim() || data.zip),
      shippingCountry: shippingSameAsBilling ? data.country : (formData.get("shippingCountry")?.toString().trim() || data.country),
    },
  });

  await logOrderEvent(order.id, "billing_info_saved", `${data.city}, ${data.state}, ${data.country}`);

  return { status: "success" };
}

/**
 * Step 2b: save billing plan selection + recalculate estimated amount.
 * Called when user advances from billing-cycle sub-step to payment.
 */
export async function saveBillingPlan(
  orderId: string,
  billingPlanId: string | null,
  listingQty: number = 1,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      checkoutPage: {
        include: {
          priceTiers: { orderBy: { sortOrder: "asc" } },
          billingPlans: true,
        },
      },
    },
  });
  if (!order || order.status === "paid") return;

  const checkoutPage = order.checkoutPage;

  // Resolve unit price from tiers
  let unitPriceCents = checkoutPage.basePriceCents;
  if (checkoutPage.priceTiers.length > 0) {
    const matchedTier = checkoutPage.priceTiers.find(
      (t) => order.quantity >= t.minQty && (t.maxQty == null || order.quantity <= t.maxQty),
    );
    if (matchedTier) unitPriceCents = matchedTier.priceCents;
  }

  // Resolve recurring from selected plan
  let recurringCents: number | null = null;
  if (billingPlanId && checkoutPage.billingPlans.length > 0) {
    const plan = checkoutPage.billingPlans.find((p) => p.id === billingPlanId);
    if (plan) recurringCents = plan.priceCents * Math.max(1, listingQty);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      selectedBillingPlanId: billingPlanId,
      amountCents: unitPriceCents * order.quantity,
      recurringAmountCents: recurringCents,
    },
  });
}

/**
 * Step 3: add-ons/upgrade, promo, and payment. Updates the order created in
 * step 1 — never creates a new one. Billing address must already be saved
 * (step 2) before this can run.
 */
export async function completeCheckout(
  orderId: string,
  _prevState: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      checkoutPage: {
        include: {
          addonLinks: { where: { addon: { isActive: true } }, include: { addon: true } },
          priceTiers: { orderBy: { sortOrder: "asc" } },
          billingPlans: true,
        },
      },
    },
  });

  if (!order) {
    return { status: "error", message: "We couldn't find this order. Please start over." };
  }
  if (order.status === "paid") {
    return { status: "error", message: "This order has already been paid." };
  }
  const { addressLine1, city, state, zip, country } = order;
  if (!addressLine1 || !city || !state || !zip || !country) {
    return { status: "error", message: "Please complete your billing address first." };
  }

  const checkoutPage = order.checkoutPage;
  const pageAddons = checkoutPage.addonLinks.map((link) => link.addon);

  const parsed = parsePaymentData(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // Check for an active promotion on this checkout page
  const now = new Date();
  const activePromo = await prisma.promotion.findFirst({
    where: {
      isActive: true,
      checkoutPages: { some: { checkoutPageId: checkoutPage.id } },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    include: { priceTier: true, promoCode: { select: { id: true, discountType: true, discountValue: true } } },
  });

  // Resolve tier-based pricing: promotion uses promo price as base (discount baked in)
  let resolvedBasePriceCents = checkoutPage.basePriceCents;
  let resolvedZohoItemId = checkoutPage.zohoItemId;
  let tierDiscountPerUnitCents = 0;
  const baseTier = checkoutPage.priceTiers.find((t) => t.isBase) ?? null;
  if (activePromo) {
    // Calculate the promo price (original tier price minus promo code discount)
    const origPrice = activePromo.priceTier.priceCents;
    const promoDiscount = activePromo.promoCode.discountType === "percent"
      ? Math.round((origPrice * activePromo.promoCode.discountValue) / 100)
      : activePromo.promoCode.discountValue;
    resolvedBasePriceCents = Math.max(0, origPrice - promoDiscount);
    // Use base tier's Zoho item if available, otherwise fall back to promo tier's
    if (baseTier?.zohoItemId) {
      resolvedZohoItemId = baseTier.zohoItemId;
    } else if (activePromo.priceTier.zohoItemId) {
      resolvedZohoItemId = activePromo.priceTier.zohoItemId;
    }
  } else if (checkoutPage.priceTiers.length > 0) {
    const matchedTier = checkoutPage.priceTiers.find(
      (t) => data.quantity >= t.minQty && (t.maxQty == null || data.quantity <= t.maxQty),
    );
    if (matchedTier) {
      resolvedBasePriceCents = matchedTier.priceCents;
      if (baseTier) {
        // Always send the base tier's Zoho item — tier discount handles the price difference
        resolvedZohoItemId = baseTier.zohoItemId ?? resolvedZohoItemId;
        tierDiscountPerUnitCents = Math.max(0, baseTier.priceCents - matchedTier.priceCents);
      } else if (matchedTier.zohoItemId) {
        resolvedZohoItemId = matchedTier.zohoItemId;
      }
    }
  }

  // Resolve billing plan
  const billingPlanId = formData.get("billingPlanId")?.toString() ?? null;
  const listingQty = Math.max(1, Number(formData.get("listingQty")) || 1);
  let resolvedRecurringPriceCents = checkoutPage.recurringPriceCents;
  let resolvedZohoRecurringItemId = checkoutPage.zohoRecurringItemId;
  let chargeRecurringAtCheckout = false;
  if (billingPlanId && checkoutPage.billingPlans.length > 0) {
    const selectedPlan = checkoutPage.billingPlans.find((p) => p.id === billingPlanId);
    if (selectedPlan) {
      chargeRecurringAtCheckout = selectedPlan.chargeAtCheckout;
      // Only include in checkout total if chargeAtCheckout is true.
      // Otherwise the recurring charge starts later (e.g. at device activation).
      // Multiply by listingQty — listings are separate from device quantity.
      resolvedRecurringPriceCents = chargeRecurringAtCheckout ? selectedPlan.priceCents * listingQty : 0;
      if (selectedPlan.zohoItemId) resolvedZohoRecurringItemId = selectedPlan.zohoItemId;
    }
  }

  const product = selectEffectiveProduct(
    {
      title: checkoutPage.title,
      basePriceCents: resolvedBasePriceCents,
      recurringPriceCents: resolvedRecurringPriceCents,
      zohoItemId: resolvedZohoItemId,
      zohoRecurringItemId: resolvedZohoRecurringItemId,
    },
    checkoutPage,
    data.upgradeSelected,
  );
  const upgradeApplied = data.upgradeSelected && hasUpgradeOffer(checkoutPage);

  const validAddonIds = new Set(pageAddons.map((a) => a.id));
  const selectedAddons = pageAddons.filter((a) => data.addonIds.includes(a.id) && validAddonIds.has(a.id));

  let promo: { id: string; type: "percent" | "fixed"; value: number } | null = null;
  // Validate promo code — but during a promotion the discount is baked into the base price
  if (data.promoCode) {
    const promoResult = await validatePromoCode(checkoutPage.id, data.promoCode);
    if (!promoResult.valid) {
      return {
        status: "error",
        message: "That promo code isn't valid.",
        fieldErrors: { promoCode: [promoResult.message] },
      };
    }
    promo = promoResult.promo!;
  }

  const price = calculateOrderPrice({
    basePriceCents: product.priceCents,
    quantity: data.quantity,
    addons: selectedAddons.map((a) => ({ priceCents: a.priceCents })),
    // During promotion the discount is already in the base price — don't double-apply
    promo: (promo && !activePromo) ? { type: promo.type, value: promo.value } : null,
    recurringPriceCents: product.recurringPriceCents,
  });

  // When the billing plan is charged at checkout, include the recurring
  // amount in the one-time charge — matches what the checkout UI displays.
  const chargeAmountCents = chargeRecurringAtCheckout
    ? price.totalCents + price.recurringTotalCents
    : price.totalCents;

  await logOrderEvent(order.id, "payment_attempted", `Charging $${(chargeAmountCents / 100).toFixed(2)}`);

  let chargeResult;
  try {
    chargeResult = await chargeCreditCard({
      cardNumber: data.cardNumber,
      expirationDate: `${data.expYear}-${data.expMonth}`,
      cardCode: data.cvv,
      firstName: order.firstName,
      lastName: order.lastName,
      address: addressLine1,
      city,
      state,
      zip,
      country,
      email: order.email,
      amountCents: chargeAmountCents,
      invoiceNumber: `inv-${Date.now()}`,
    });
  } catch (err) {
    console.error("Authorize.net charge threw", err);
    await logOrderEvent(order.id, "payment_failed", "Authorize.net request failed");
    return { status: "error", message: "We couldn't process your payment. Please try again." };
  }

  await logOrderEvent(
    order.id,
    chargeResult.success ? "payment_succeeded" : "payment_failed",
    chargeResult.success ? chargeResult.description : chargeResult.errorMessage,
  );

  // Persist the outcome regardless of success so declines are visible in the
  // admin order log too, matching legacy behavior.
  await prisma.order.update({
    where: { id: order.id },
    data: {
      promoCodeId: promo?.id,
      cardLast4: getCardLast4(data.cardNumber),
      cardBrand: detectCardBrand(data.cardNumber),
      cardNumberEncrypted: encryptCardField(data.cardNumber),
      cardCvvEncrypted: encryptCardField(data.cvv),
      cardExpiryEncrypted: encryptCardField(`${data.expMonth}/${data.expYear}`),
      quantity: data.quantity,
      amountCents: chargeAmountCents,
      recurringAmountCents: price.recurringTotalCents || null,
      upgradeSelected: upgradeApplied,
      selectedBillingPlanId: billingPlanId,
      authNetResponseCode: chargeResult.responseCode,
      authNetAuthCode: chargeResult.authCode,
      authNetTransactionId: chargeResult.transactionId,
      authNetMessage: chargeResult.success ? chargeResult.description : chargeResult.errorMessage,
      status: chargeResult.success ? "paid" : "failed",
      orderAddons: {
        create: selectedAddons.map((a) => ({ addonId: a.id, priceCents: a.priceCents })),
      },
    },
  });

  if (!chargeResult.success) {
    return {
      status: "error",
      message: chargeResult.errorMessage ?? "Transaction declined. Please check your card details and try again.",
    };
  }

  // Post-payment side effects (Zoho, email, promo redemption count) must
  // never block or fail the checkout — the card has already been charged.
  try {
    if (promo) {
      await prisma.promoCode.update({
        where: { id: promo.id },
        data: { timesRedeemed: { increment: 1 } },
      });
      await logOrderEvent(order.id, "promo_applied", `Code ${promo && data.promoCode ? data.promoCode.toUpperCase() : ""}`);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const nextMonthStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Include billing plan in line_item only when chargeAtCheckout is true
    const billingPlanZohoId = chargeRecurringAtCheckout ? resolvedZohoRecurringItemId : null;
    const lineItems = buildZohoLineItems(product, data.quantity, selectedAddons, billingPlanZohoId, listingQty);
    const recurringInvoiceItems = buildZohoRecurringLineItems(product, price.recurringTotalCents, data.quantity);

    // Always send shipping address to Zoho — use separate shipping if provided, else billing
    const zohoShippingAddress = !order.shippingSameAsBilling && order.shippingAddressLine1
      ? {
          streetad: order.shippingAddressLine1,
          city: order.shippingCity || city,
          state: order.shippingState || state,
          zipcode: order.shippingZip || zip,
          country: order.shippingCountry || country,
        }
      : {
          streetad: addressLine1,
          city,
          state,
          zipcode: zip,
          country,
        };

    // Compute discount in dollars for Zoho (final total, not per-unit)
    let zohoDiscountDollars = 0;
    // Tier discount: difference between base tier price and matched tier price
    if (tierDiscountPerUnitCents > 0) {
      zohoDiscountDollars += (tierDiscountPerUnitCents * data.quantity) / 100;
    }
    if (activePromo) {
      // Promotion: per-unit savings × quantity
      const perUnitSavingsCents = activePromo.priceTier.priceCents - resolvedBasePriceCents;
      zohoDiscountDollars += (perUnitSavingsCents * data.quantity) / 100;
    } else if (promo) {
      if (promo.type === "percent") {
        zohoDiscountDollars += Math.round((price.subtotalCents * promo.value) / 100) / 100;
      } else {
        zohoDiscountDollars += promo.value / 100;
      }
    }

    const zohoResult = await postZohoInvoice({
      firstName: order.firstName,
      lastName: order.lastName,
      email: order.email,
      phone: order.phone,
      streetAddress: addressLine1,
      city,
      state,
      zipCode: zip,
      country,
      amountCents: chargeAmountCents,
      startDate: nextMonthStr,
      payDate: todayStr,
      lineItems,
      recurringInvoiceItems,
      shippingAddress: zohoShippingAddress,
      discountAmount: zohoDiscountDollars || undefined,
      fulfillmentItems: lineItems,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        zohoSynced: zohoResult.success,
        zohoPayload: zohoResult.payload as object,
        zohoResponse: (zohoResult.response ?? { error: zohoResult.error }) as object,
      },
    });
    await logOrderEvent(order.id, zohoResult.success ? "zoho_synced" : "zoho_failed", zohoResult.success ? undefined : zohoResult.error);

    const emailSettings = await getEmailSettings();

    // Resolve billing plan for internal email
    const selectedBillingPlan = billingPlanId
      ? checkoutPage.billingPlans.find((p) => p.id === billingPlanId) ?? null
      : null;

    // Build address strings
    const billingAddr = `${addressLine1}, ${city}, ${state} ${zip}, ${country}`;
    const shippingAddr = order.shippingSameAsBilling
      ? "Same as billing"
      : [order.shippingAddressLine1, order.shippingCity, order.shippingState, order.shippingZip, order.shippingCountry].filter(Boolean).join(", ") || "Same as billing";

    // Unit price for display
    const fmtDollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
    const unitSubtotal = resolvedBasePriceCents * data.quantity;
    const planLabel = selectedBillingPlan
      ? `${selectedBillingPlan.label} (${selectedBillingPlan.interval})`
      : "—";
    const planIntervalLabel = selectedBillingPlan?.interval === "annually" ? "year" : "month";
    const planPrice = selectedBillingPlan
      ? `${fmtDollars(selectedBillingPlan.priceCents)}/${planIntervalLabel} × ${listingQty} ${listingQty === 1 ? "listing" : "listings"}`
      : "—";
    const addonsText = selectedAddons.length
      ? selectedAddons.map((a) => `${a.name} (${fmtDollars(a.priceCents)})`).join(", ")
      : "—";
    const promoText = promo && data.promoCode ? data.promoCode.toUpperCase() : "—";
    let discountText = "—";
    if (activePromo) {
      // Promotion: discount is baked into resolvedBasePriceCents — show per-unit savings
      const perUnitSavings = activePromo.priceTier.priceCents - resolvedBasePriceCents;
      discountText = `Promotion: −${fmtDollars(perUnitSavings * data.quantity)} (${fmtDollars(perUnitSavings)}/ea × ${data.quantity})`;
    } else if (promo) {
      if (promo.type === "percent") {
        const discountCents = Math.round((price.subtotalCents * promo.value) / 100);
        discountText = `${promo.value}% off (−${fmtDollars(discountCents)})`;
      } else {
        discountText = `−${fmtDollars(promo.value)}`;
      }
    }

    // Build HTML breakdown for internal notification
    const orderBreakdownHtml = `
<table style="border-collapse:collapse;width:100%;max-width:600px;font-family:sans-serif;font-size:14px;color:#333">
  <tr><td colspan="2" style="padding:8px 0;font-weight:bold;font-size:16px;border-bottom:2px solid #e5e7eb">Order Summary</td></tr>
  <tr><td style="padding:6px 0;color:#666">Product</td><td style="padding:6px 0;text-align:right">${product.title}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Quantity</td><td style="padding:6px 0;text-align:right">${data.quantity}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Unit price</td><td style="padding:6px 0;text-align:right">${fmtDollars(resolvedBasePriceCents)} × ${data.quantity} = ${fmtDollars(unitSubtotal)}${activePromo ? ` (was ${fmtDollars(activePromo.priceTier.priceCents)}/ea — promo)` : ""}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Billing type</td><td style="padding:6px 0;text-align:right">${planLabel}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Plan price</td><td style="padding:6px 0;text-align:right">${planPrice}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Recurring total</td><td style="padding:6px 0;text-align:right">${price.recurringTotalCents ? fmtDollars(price.recurringTotalCents) : "—"}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Add-ons</td><td style="padding:6px 0;text-align:right">${addonsText}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Promo code</td><td style="padding:6px 0;text-align:right">${promoText}</td></tr>
  ${(promo || activePromo) ? `<tr><td style="padding:6px 0;color:#666">Discount</td><td style="padding:6px 0;text-align:right;color:#dc2626">${discountText}</td></tr>` : ""}
  <tr><td style="padding:8px 0;font-weight:bold;border-top:2px solid #e5e7eb">Total charged</td><td style="padding:8px 0;text-align:right;font-weight:bold;border-top:2px solid #e5e7eb">${fmtDollars(chargeAmountCents)}</td></tr>
  <tr><td colspan="2" style="padding:12px 0 4px;font-weight:bold;font-size:16px;border-bottom:2px solid #e5e7eb">Customer</td></tr>
  <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0;text-align:right">${order.email}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0;text-align:right">${order.phone}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Billing address</td><td style="padding:6px 0;text-align:right">${billingAddr}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Shipping address</td><td style="padding:6px 0;text-align:right">${shippingAddr}</td></tr>
</table>`.trim();

    const emailVars: Record<string, string> = {
      orderId: order.id,
      productName: product.title,
      firstName: order.firstName,
      lastName: order.lastName,
      email: order.email,
      phone: order.phone,
      amount: fmtDollars(chargeAmountCents),
      quantity: String(data.quantity),
      unitPrice: fmtDollars(resolvedBasePriceCents),
      billingType: planLabel,
      planPrice,
      recurringTotal: price.recurringTotalCents ? fmtDollars(price.recurringTotalCents) : "—",
      addons: addonsText,
      promoCode: promoText,
      discount: discountText,
      billingAddress: billingAddr,
      shippingAddress: shippingAddr,
      orderBreakdown: orderBreakdownHtml,
      cardHashKey: order.cardHashKey,
    };

    // Shared with the admin "Resend" action (lib/email/send-order-confirmation.ts)
    // so both paths render and log identically instead of drifting apart.
    const customerEmailResult = await sendOrderConfirmationEmail(order.id);
    if (!customerEmailResult.success) {
      console.error("Customer confirmation email failed for order", order.id, customerEmailResult.error);
    }

    if (emailSettings.internalNotifyEmails.length) {
      const internalEmailResult = await sendEmail({
        to: emailSettings.internalNotifyEmails,
        subject: renderEmailTemplate(emailSettings.internalNotifySubject, emailVars),
        html: renderEmailTemplate(emailSettings.internalNotifyHtml, emailVars),
        apiKey: emailSettings.sendgridApiKey,
        from: emailSettings.emailFrom,
      });
      await logOrderEvent(
        order.id,
        internalEmailResult.success ? "internal_email_sent" : "internal_email_failed",
        internalEmailResult.success ? undefined : internalEmailResult.error,
      );
      if (!internalEmailResult.success) {
        console.error("Internal notification email failed for order", order.id, internalEmailResult.error);
      }
    }

    if (checkoutPage.webhookUrl) {
      const shippingWebhook = !order.shippingSameAsBilling && order.shippingAddressLine1
        ? { address: order.shippingAddressLine1, city: order.shippingCity || city, state: order.shippingState || state, zip: order.shippingZip || zip, country: order.shippingCountry || country }
        : { address: addressLine1, city, state, zip, country };
      const webhookResult = await sendOrderWebhook(checkoutPage.webhookUrl, {
        fname: order.firstName,
        lname: order.lastName,
        email: order.email,
        phone: order.phone,
        streetad: addressLine1,
        city,
        state,
        zipcode: zip,
        country,
        shipping_address: shippingWebhook.address,
        shipping_city: shippingWebhook.city,
        shipping_state: shippingWebhook.state,
        shipping_zipcode: shippingWebhook.zip,
        shipping_country: shippingWebhook.country,
        amount: String(chargeAmountCents / 100),
        start_date: nextMonthStr,
        pay_date: todayStr,
        invoice_Date: String(Math.floor(Date.now() / 1000)),
        autoaccountID: chargeResult.transactionId ?? "",
        promo_code: promo ? data.promoCode : "",
        is_promo_valid: promo ? "true" : "false",
        product_name: product.title,
        billing: selectedBillingPlan ? selectedBillingPlan.label : (checkoutPage.billingInterval ?? ""),
        qty: String(data.quantity),
        unit_Price: String(resolvedBasePriceCents / 100),
        BumpOrder: upgradeApplied ? "true" : "false",
        rec_amount: String(price.recurringTotalCents / 100),
      });
      await logOrderEvent(order.id, webhookResult.success ? "webhook_sent" : "webhook_failed", webhookResult.success ? undefined : webhookResult.error);
      if (!webhookResult.success) {
        console.error("Order webhook failed for order", order.id, webhookResult.error);
      }
    }
  } catch (err) {
    console.error("Post-payment side effects failed for order", order.id, err);
  }

  return {
    status: "success",
    redirectUrl: `${checkoutPage.successRedirectUrl}?tracking=${order.id}&amount=${(chargeAmountCents / 100).toFixed(2)}`,
  };
}
