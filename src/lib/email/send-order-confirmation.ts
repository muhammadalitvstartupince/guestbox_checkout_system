import { prisma } from "@/lib/db/client";
import { sendEmail, type SendEmailResult } from "@/lib/email/send";
import { getEmailSettings } from "@/lib/email/settings";
import { renderEmailTemplate } from "@/lib/email/render-template";
import { logOrderEvent } from "@/lib/orders/log-event";

/**
 * Sends (or resends) the customer confirmation email for an order, always
 * re-rendered from the order's current stored data and whatever the
 * customer-confirmation template currently says — used both right after a
 * successful charge (app/c/[slug]/actions.ts) and from the admin "Resend"
 * button (app/(main)/admin/(protected)/orders/[id]/actions.ts), so both paths stay
 * byte-for-byte identical instead of drifting apart.
 */
export async function sendOrderConfirmationEmail(orderId: string, note?: string): Promise<SendEmailResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { checkoutPage: { select: { title: true, upgradeTitle: true } } },
  });
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  const emailSettings = await getEmailSettings();
  if (!emailSettings.customerConfirmationEnabled) {
    await logOrderEvent(orderId, "customer_email_skipped", "Customer confirmation email is disabled in settings");
    return { success: true };
  }

  const productName =
    order.upgradeSelected && order.checkoutPage.upgradeTitle ? order.checkoutPage.upgradeTitle : order.checkoutPage.title;

  const fmtDollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const billingAddr = order.addressLine1
    ? `${order.addressLine1}, ${order.city}, ${order.state} ${order.zip}, ${order.country}`
    : "—";
  const shippingAddr = order.shippingSameAsBilling
    ? "Same as billing"
    : order.shippingAddressLine1
      ? `${order.shippingAddressLine1}, ${order.shippingCity}, ${order.shippingState} ${order.shippingZip}, ${order.shippingCountry}`
      : "Same as billing";

  const emailVars: Record<string, string> = {
    orderId: order.id,
    productName,
    firstName: order.firstName,
    lastName: order.lastName,
    email: order.email,
    phone: order.phone,
    amount: order.amountCents != null ? fmtDollars(order.amountCents) : "$0.00",
    quantity: String(order.quantity),
    unitPrice: order.amountCents != null ? fmtDollars(Math.round(order.amountCents / order.quantity)) : "—",
    billingType: "—",
    billingAddress: billingAddr,
    shippingAddress: shippingAddr,
  };

  const result = await sendEmail({
    to: order.email,
    subject: renderEmailTemplate(emailSettings.customerConfirmationSubject, emailVars),
    html: renderEmailTemplate(emailSettings.customerConfirmationHtml, emailVars),
    apiKey: emailSettings.sendgridApiKey,
    from: emailSettings.emailFrom,
  });

  await logOrderEvent(
    order.id,
    result.success ? "customer_email_sent" : "customer_email_failed",
    result.success ? note : [note, result.error].filter(Boolean).join(" — ") || result.error,
  );

  return result;
}
