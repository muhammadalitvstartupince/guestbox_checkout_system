"use server";

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/http/client-info";
import { verifyAdminSession } from "@/lib/auth/dal";
import { decryptCardField } from "@/lib/crypto/card-crypto";
import { postZohoInvoice } from "@/lib/zoho/post-invoice";
import { buildZohoLineItems, buildZohoRecurringLineItems } from "@/lib/zoho/order-payload";
import { selectEffectiveProduct } from "@/lib/checkout/select-product";
import { logOrderEvent } from "@/lib/orders/log-event";
import { sendOrderConfirmationEmail } from "@/lib/email/send-order-confirmation";
import type { RevealCardState } from "./types";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function revealCard(
  orderId: string,
  _prevState: RevealCardState,
  formData: FormData,
): Promise<RevealCardState> {
  const session = await verifyAdminSession();
  const enteredKey = formData.get("hashKey")?.toString().trim() ?? "";

  if (!enteredKey) {
    return { status: "error", message: "Enter the reveal key." };
  }

  // One shared secret (set once, out of band, via env) unlocks any order's
  // card — replaces the old per-order DB-stored hash key, which meant
  // looking up a different value per order before you could reveal it.
  const revealKey = process.env.CARD_REVEAL_KEY;
  if (!revealKey) {
    return { status: "error", message: "CARD_REVEAL_KEY is not configured on the server." };
  }
  if (!safeCompare(revealKey, enteredKey)) {
    return { status: "error", message: "Invalid reveal key." };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return { status: "error", message: "Order not found." };
  }
  if (!order.cardNumberEncrypted || !order.cardCvvEncrypted) {
    return { status: "error", message: "No card on file for this order yet." };
  }

  let cardNumber: string;
  let cvv: string;
  let expiry: string | undefined;
  try {
    cardNumber = decryptCardField(order.cardNumberEncrypted);
    cvv = decryptCardField(order.cardCvvEncrypted);
    expiry = order.cardExpiryEncrypted ? decryptCardField(order.cardExpiryEncrypted) : undefined;
  } catch {
    return { status: "error", message: "Failed to decrypt card data." };
  }

  const ipAddress = getClientIp(await headers());

  await prisma.cardAccessAuditLog.create({
    data: {
      orderId: order.id,
      adminUserId: session.adminUserId as string,
      ipAddress,
    },
  });

  return { status: "revealed", cardNumber, cvv, expiry };
}

export async function retryZohoSync(orderId: string): Promise<void> {
  await verifyAdminSession();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      checkoutPage: {
        select: {
          title: true,
          basePriceCents: true,
          recurringPriceCents: true,
          zohoItemId: true,
          zohoRecurringItemId: true,
          upgradeTitle: true,
          upgradeDescription: true,
          upgradePriceCents: true,
          upgradeRecurringPriceCents: true,
          upgradeZohoItemId: true,
          upgradeZohoRecurringItemId: true,
        },
      },
      orderAddons: { include: { addon: { select: { zohoItemId: true } } } },
    },
  });
  if (!order) return;

  // Sync only makes sense once the order actually completed payment (step 2)
  // — a "pending" order that never got that far has nothing to invoice yet.
  const { amountCents, addressLine1, city, state, zip, country } = order;
  if (amountCents == null || addressLine1 == null || city == null || state == null || zip == null || country == null) {
    return;
  }

  const product = selectEffectiveProduct(order.checkoutPage, order.checkoutPage, order.upgradeSelected);

  // Resolve billing plan — include in line_item only if chargeAtCheckout
  const billingPlan = order.selectedBillingPlanId
    ? await prisma.billingPlan.findUnique({ where: { id: order.selectedBillingPlanId }, select: { zohoItemId: true, chargeAtCheckout: true } })
    : null;
  const billingPlanZohoId = billingPlan?.chargeAtCheckout ? billingPlan.zohoItemId : null;

  const lineItems = buildZohoLineItems(
    product,
    order.quantity,
    order.orderAddons.map((a) => a.addon),
    billingPlanZohoId,
  );
  const recurringInvoiceItems = buildZohoRecurringLineItems(product, order.recurringAmountCents ?? 0, order.quantity);

  // Dates reflect when the order was actually placed, not when the retry runs.
  const payDate = order.createdAt.toISOString().slice(0, 10);
  const startDate = new Date(order.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Build shipping address for Zoho (only if different from billing)
  const shippingAddress = !order.shippingSameAsBilling && order.shippingAddressLine1
    ? {
        address: order.shippingAddressLine1,
        city: order.shippingCity || city,
        state: order.shippingState || state,
        zip: order.shippingZip || zip,
        country: order.shippingCountry || country,
      }
    : undefined;

  const result = await postZohoInvoice({
    firstName: order.firstName,
    lastName: order.lastName,
    email: order.email,
    phone: order.phone,
    streetAddress: addressLine1,
    city,
    state,
    zipCode: zip,
    country,
    amountCents,
    startDate,
    payDate,
    lineItems,
    recurringInvoiceItems,
    shippingAddress,
    fulfillmentItems: lineItems,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      zohoSynced: result.success,
      zohoPayload: result.payload as object,
      zohoResponse: (result.response ?? { error: result.error }) as object,
    },
  });
  await logOrderEvent(order.id, result.success ? "zoho_synced" : "zoho_failed", result.success ? "Manual retry" : result.error);
}

export async function resendConfirmationEmail(orderId: string): Promise<void> {
  await verifyAdminSession();
  await sendOrderConfirmationEmail(orderId, "Manually resent by admin");
}
